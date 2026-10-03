// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapRouter} from "./interfaces/External.sol";
import {TicketMath} from "./TicketMath.sol";
import {Oracle} from "./Oracle.sol";

interface IVault {
    function lend(uint256 amount) external;
    function repay(uint256 principal, uint256 markup) external;
    function writeOff(uint256 principal) external;
    function assertHealthy() external view;
}

interface IFund {
    function receiveShare(uint256 amount) external;
}

/// @title Desk (term mode)
/// @notice Runs murabaha tickets for one bucket. For each ticket the vault's USDC buys a
///         coin on the spot market, the coin is sold to the trader at cost plus a fixed
///         markup, and the coin stays pledged here until the balance is paid.
///         Term mode: nobody but the trader can sell the coin before the due date.
/// @dev    Rules this contract must always keep:
///         - the coin is bought before it is sold to the trader;
///         - a ticket's balance never increases;
///         - the vault never receives more than the settlement amount;
///         - the trader never owes more than the pledged coin fetches;
///         - the pledged coin leaves only to the trader (paid off) or to the market;
///         - close, pay off, part payment and settlement cannot be paused.
contract Desk is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotAllowed();
    error Paused();
    error BadLeverage();
    error BadTerm();
    error TooLarge();
    error TooManyTickets();
    error NotOwner();
    error NotLive();
    error NotDue();
    error SaleBelowSettlement();
    error BadAmount();
    error OutOfBounds();
    error ZeroAddress();
    error Slippage();

    enum Status {
        None,
        Live,
        Closed,
        PaidOff,
        Settled,
        SettledShort
    }

    struct Ticket {
        address owner;
        Status status;
        uint40 opened;
        uint40 due;
        uint256 qty; // pledged coin
        uint256 cost; // what the vault paid for the coin
        uint256 downPayment;
        uint256 financed; // cost minus down payment
        uint256 markup; // fixed at opening
        uint256 repaid; // part payments so far
        uint256 principalRepaid; // of `repaid`, the part that was principal
    }

    event Opened(
        uint256 indexed id, address indexed owner, uint256 qty, uint256 cost, uint256 downPayment, uint256 markup, uint256 due
    );
    event Paid(uint256 indexed id, address indexed owner, uint256 principal, uint256 markup);
    event PartPaid(uint256 indexed id, uint256 amount);
    event Ended(uint256 indexed id, Status status, uint256 coinValue, uint256 toTrader, uint256 toFund, uint256 shortfall);
    event OwedClaimed(address indexed user, uint256 amount);
    event ParamsSet(
        uint256 baseRateBps, uint256 surchargeBps, uint256 surchargeAboveBps, uint256 maxLeverageBps, uint256 maxCost, uint256 maxLive
    );

    uint256 internal constant BPS = 10_000;
    uint256 public constant PROFIT_SHARE_BPS = 3_000;
    // Hard limits the admin can never exceed.
    uint256 public constant MAX_RATE_BPS = 5_000;
    uint256 public constant MAX_TERM = 30 days;
    uint256 public constant MAX_LIVE = 500;
    uint256 public constant MAX_SALE_TOLERANCE_BPS = 500;
    uint256 public constant MAX_KEEPER_FEE = 20e6;

    IERC20 public immutable usdc;
    IERC20 public immutable coin;
    IVault public immutable vault;
    ISwapRouter public immutable router;
    uint24 public immutable poolFee;
    /// The leverage ceiling approved for this coin. Fixed for good.
    uint256 public immutable hardMaxLeverageBps;

    Oracle public oracle;
    IFund public fund;
    address public guardian;

    // Parameters (admin, through the time-lock). They apply only to new tickets.
    uint256 public baseRateBps = 1_000;
    uint256 public surchargeBps = 100;
    uint256 public surchargeAboveBps = 20_000; // leverage above this pays the surcharge
    uint256 public maxLeverageBps;
    uint256 public maxCost = 100_000e6;
    uint256 public maxLive = 200;
    uint256 public saleToleranceBps = 100;
    uint256 public keeperFee = 1e6;
    mapping(uint256 => bool) public termAllowed;
    bool public allowlistOn = true;
    bool public openingPaused;
    mapping(address => bool) public traderAllowed;

    uint256 public nextId = 1;
    mapping(uint256 => Ticket) public tickets;
    uint256[] public liveIds;
    mapping(uint256 => uint256) internal liveIndex; // id => index + 1
    /// Settlement surpluses wait here for the trader, so a blocked recipient cannot block a settlement.
    mapping(address => uint256) public owed;
    uint256 public totalOwed;

    constructor(
        IERC20 usdc_,
        IERC20 coin_,
        IVault vault_,
        ISwapRouter router_,
        uint24 poolFee_,
        Oracle oracle_,
        IFund fund_,
        uint256 hardMaxLeverageBps_,
        address owner_
    ) Ownable(owner_) {
        if (address(fund_) == address(0) || address(oracle_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
        coin = coin_;
        vault = vault_;
        router = router_;
        poolFee = poolFee_;
        oracle = oracle_;
        fund = fund_;
        hardMaxLeverageBps = hardMaxLeverageBps_;
        maxLeverageBps = hardMaxLeverageBps_;
        termAllowed[7 days] = true;
        termAllowed[14 days] = true;
    }

    // ───────────────────────── Views ─────────────────────────

    function rateBps(uint256 leverageBps) public view returns (uint256) {
        return baseRateBps + (leverageBps > surchargeAboveBps ? surchargeBps : 0);
    }

    /// What closes the ticket today.
    function settlementAmount(uint256 id) public view returns (uint256) {
        Ticket storage t = tickets[id];
        return TicketMath.settlement(t.financed, t.markup, t.repaid, t.opened, t.due, block.timestamp);
    }

    function getTicket(uint256 id) external view returns (Ticket memory) {
        return tickets[id];
    }

    function liveCount() external view returns (uint256) {
        return liveIds.length;
    }

    /// For the vault's share price: every live ticket at the lower of its settlement
    /// amount and its coin's value, and the total by which coins fall short.
    /// Gas is bounded by `maxLive`.
    function bookValue() external view returns (uint256 book, uint256 shortfall) {
        uint256 n = liveIds.length;
        if (n == 0) return (0, 0);
        uint256 unit = oracle.value(1e18); // one call; scaled back per ticket below
        for (uint256 i; i < n; ++i) {
            uint256 id = liveIds[i];
            uint256 s = settlementAmount(id);
            uint256 v = tickets[id].qty * unit / 1e18;
            if (v < s) {
                book += v;
                shortfall += s - v;
            } else {
                book += s;
            }
        }
    }

    // ───────────────────────── Opening ─────────────────────────

    /// Open a ticket. `minCoinOut` is the trader's price limit: the least coin they
    /// accept for the full cost. Everything happens in this one transaction.
    function open(uint256 downPayment, uint256 leverageBps, uint256 term, uint256 minCoinOut)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (openingPaused) revert Paused();
        if (allowlistOn && !traderAllowed[msg.sender]) revert NotAllowed();
        if (leverageBps <= BPS || leverageBps > maxLeverageBps) revert BadLeverage();
        if (!termAllowed[term]) revert BadTerm();
        if (liveIds.length >= maxLive) revert TooManyTickets();
        uint256 cost = TicketMath.cost(downPayment, leverageBps);
        if (cost == 0 || cost > maxCost) revert TooLarge();
        uint256 financed = cost - downPayment;

        // 1. The vault buys the coin with its own USDC. The feed floors the price so a
        //    trader cannot make the vault overpay into a pool they have moved.
        vault.lend(cost);
        uint256 floorQty = oracle.quantity(cost) * (BPS - saleToleranceBps) / BPS;
        uint256 qty = _swap(usdc, coin, cost, minCoinOut > floorQty ? minCoinOut : floorQty);

        // 2. The vault sells the coin to the trader at cost plus markup. The down
        //    payment is the first part of the price.
        usdc.safeTransferFrom(msg.sender, address(this), downPayment);
        usdc.forceApprove(address(vault), downPayment);
        vault.repay(downPayment, 0);
        vault.assertHealthy();

        // 3. The coin stays here, pledged against the balance.
        id = nextId++;
        uint256 markup = TicketMath.markup(financed, rateBps(leverageBps), term);
        tickets[id] = Ticket({
            owner: msg.sender,
            status: Status.Live,
            opened: uint40(block.timestamp),
            due: uint40(block.timestamp + term),
            qty: qty,
            cost: cost,
            downPayment: downPayment,
            financed: financed,
            markup: markup,
            repaid: 0,
            principalRepaid: 0
        });
        liveIds.push(id);
        liveIndex[id] = liveIds.length;
        emit Opened(id, msg.sender, qty, cost, downPayment, markup, block.timestamp + term);
    }

    // ───────────────────────── The trader's exits (never pausable) ─────────────────────────

    /// Sell the coin on the market, pay the vault the settlement amount, keep the rest.
    /// Fails if the sale would not cover the settlement amount.
    function close(uint256 id, uint256 minUsdcOut) external nonReentrant {
        Ticket storage t = _liveOwned(id);
        uint256 s = settlementAmount(id);
        uint256 proceeds = _swap(coin, usdc, t.qty, _floorOr(t.qty, minUsdcOut));
        if (proceeds < s) revert SaleBelowSettlement();

        _payVault(id, t, s);
        uint256 surplus = proceeds - s;
        uint256 share = TicketMath.profitShare(surplus, t.downPayment + t.repaid, PROFIT_SHARE_BPS);
        _toFund(share);
        usdc.safeTransfer(t.owner, surplus - share);
        _end(id, t, Status.Closed, proceeds, surplus - share, share, 0);
    }

    /// Pay the settlement amount in USDC and take the coin. The profit share is
    /// computed from the price feed, so paying off cannot be used to avoid it.
    function payOff(uint256 id) external nonReentrant {
        Ticket storage t = _liveOwned(id);
        uint256 s = settlementAmount(id);
        // If the feed is down the trader can still leave; the share is then zero.
        uint256 coinValue;
        try oracle.value(t.qty) returns (uint256 v) {
            coinValue = v;
        } catch {}
        uint256 share =
            TicketMath.profitShare(coinValue > s ? coinValue - s : 0, t.downPayment + t.repaid, PROFIT_SHARE_BPS);

        usdc.safeTransferFrom(msg.sender, address(this), s + share);
        _payVault(id, t, s);
        _toFund(share);
        coin.safeTransfer(t.owner, t.qty);
        _end(id, t, Status.PaidOff, coinValue, 0, share, 0);
    }

    /// Reduce the balance. The coin stays pledged.
    function partPay(uint256 id, uint256 amount) external nonReentrant {
        Ticket storage t = _liveOwned(id);
        if (amount == 0 || amount >= settlementAmount(id)) revert BadAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        (uint256 principal, uint256 markup) = TicketMath.split(amount, t.financed - t.principalRepaid);
        t.repaid += amount;
        t.principalRepaid += principal;
        usdc.forceApprove(address(vault), amount);
        vault.repay(principal, markup);
        emit PartPaid(id, amount);
        emit Paid(id, t.owner, principal, markup);
    }

    // ───────────────────────── Settlement (anyone, after the due date) ─────────────────────────

    /// Sell the coin and settle. The vault takes the balance, the trader the surplus.
    /// If the sale falls short the debt is closed and the vault absorbs the gap.
    function settle(uint256 id) external nonReentrant {
        Ticket storage t = tickets[id];
        if (t.status != Status.Live) revert NotLive();
        if (block.timestamp <= t.due) revert NotDue();

        // Reverts if the feed is down: an unprotected sale could be sandwiched.
        uint256 proceeds = _swap(coin, usdc, t.qty, oracle.value(t.qty) * (BPS - saleToleranceBps) / BPS);
        uint256 fee = keeperFee < proceeds ? keeperFee : proceeds;
        uint256 net = proceeds - fee;
        uint256 balance = t.financed + t.markup - t.repaid;

        if (net >= balance) {
            _payVault(id, t, balance);
            uint256 surplus = net - balance;
            uint256 share = TicketMath.profitShare(surplus, t.downPayment + t.repaid, PROFIT_SHARE_BPS);
            _toFund(share);
            owed[t.owner] += surplus - share;
            totalOwed += surplus - share;
            _end(id, t, Status.Settled, proceeds, surplus - share, share, 0);
        } else {
            uint256 principalLeft = t.financed - t.principalRepaid;
            uint256 shortfall = net < principalLeft ? principalLeft - net : 0;
            _payVault(id, t, net);
            _end(id, t, Status.SettledShort, proceeds, 0, 0, shortfall);
        }
        if (fee > 0) usdc.safeTransfer(msg.sender, fee);
    }

    /// Collect a settlement surplus.
    function claimOwed() external nonReentrant {
        uint256 amount = owed[msg.sender];
        owed[msg.sender] = 0;
        totalOwed -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit OwedClaimed(msg.sender, amount);
    }

    // ───────────────────────── Internals ─────────────────────────

    function _liveOwned(uint256 id) internal view returns (Ticket storage t) {
        t = tickets[id];
        if (t.status != Status.Live) revert NotLive();
        if (t.owner != msg.sender) revert NotOwner();
    }

    /// The trader's own limit, raised to the feed floor when the feed is live.
    function _floorOr(uint256 qty, uint256 minOut) internal view returns (uint256) {
        try oracle.value(qty) returns (uint256 v) {
            uint256 floor = v * (BPS - saleToleranceBps) / BPS;
            return minOut > floor ? minOut : floor;
        } catch {
            return minOut;
        }
    }

    function _swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, uint256 minOut) internal returns (uint256 out) {
        uint256 before = tokenOut.balanceOf(address(this));
        tokenIn.forceApprove(address(router), amountIn);
        router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(tokenIn),
                tokenOut: address(tokenOut),
                fee: poolFee,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
        out = tokenOut.balanceOf(address(this)) - before;
        if (out < minOut) revert Slippage();
    }

    /// Pay `amount` to the vault as principal first, then markup, and write off any
    /// principal that is still outstanding.
    function _payVault(uint256 id, Ticket storage t, uint256 amount) internal {
        uint256 principalLeft = t.financed - t.principalRepaid;
        (uint256 principal, uint256 markup) = TicketMath.split(amount, principalLeft);
        usdc.forceApprove(address(vault), amount);
        vault.repay(principal, markup);
        if (principal < principalLeft) vault.writeOff(principalLeft - principal);
        t.principalRepaid = t.financed;
        emit Paid(id, t.owner, principal, markup);
    }

    function _toFund(uint256 share) internal {
        if (share == 0) return;
        usdc.forceApprove(address(fund), share);
        fund.receiveShare(share);
    }

    function _end(uint256 id, Ticket storage t, Status status, uint256 coinValue, uint256 toTrader, uint256 toFund, uint256 shortfall)
        internal
    {
        t.status = status;
        t.qty = 0;
        uint256 index = liveIndex[id] - 1;
        uint256 last = liveIds[liveIds.length - 1];
        liveIds[index] = last;
        liveIndex[last] = index + 1;
        liveIds.pop();
        delete liveIndex[id];
        emit Ended(id, status, coinValue, toTrader, toFund, shortfall);
    }

    // ───────────────────────── Admin (time-lock) and guardian ─────────────────────────

    function setParams(
        uint256 baseRateBps_,
        uint256 surchargeBps_,
        uint256 surchargeAboveBps_,
        uint256 maxLeverageBps_,
        uint256 maxCost_,
        uint256 maxLive_
    ) external onlyOwner {
        if (
            baseRateBps_ + surchargeBps_ > MAX_RATE_BPS || maxLeverageBps_ > hardMaxLeverageBps || maxLive_ > MAX_LIVE
        ) revert OutOfBounds();
        baseRateBps = baseRateBps_;
        surchargeBps = surchargeBps_;
        surchargeAboveBps = surchargeAboveBps_;
        maxLeverageBps = maxLeverageBps_;
        maxCost = maxCost_;
        maxLive = maxLive_;
        emit ParamsSet(baseRateBps_, surchargeBps_, surchargeAboveBps_, maxLeverageBps_, maxCost_, maxLive_);
    }

    function setSaleParams(uint256 saleToleranceBps_, uint256 keeperFee_) external onlyOwner {
        if (saleToleranceBps_ > MAX_SALE_TOLERANCE_BPS || keeperFee_ > MAX_KEEPER_FEE) revert OutOfBounds();
        saleToleranceBps = saleToleranceBps_;
        keeperFee = keeperFee_;
    }

    function setTerm(uint256 term, bool allowed) external onlyOwner {
        if (term < TicketMath.MIN_EARNED || term > MAX_TERM) revert OutOfBounds();
        termAllowed[term] = allowed;
    }

    function setOracle(Oracle oracle_) external onlyOwner {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        oracle = oracle_;
    }

    function setFund(IFund fund_) external onlyOwner {
        if (address(fund_) == address(0)) revert ZeroAddress();
        fund = fund_;
    }

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
    }

    function setAllowlist(bool on) external onlyOwner {
        allowlistOn = on;
    }

    function setTrader(address user, bool allowed) external onlyOwner {
        traderAllowed[user] = allowed;
    }

    /// Only new tickets can be paused. Every exit keeps working.
    function pauseOpening(bool paused) external {
        if (msg.sender != owner() && !(paused && msg.sender == guardian)) revert NotAllowed();
        openingPaused = paused;
    }
}
