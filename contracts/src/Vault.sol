// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IDeskBook {
    function bookValue() external view returns (uint256 book, uint256 shortfall);
}

interface IBackstopFund {
    function cover(uint256 amount) external returns (uint256 paid);
}

/// @title Vault
/// @notice One bucket: a mudarabah pool of USDC for one coin. Depositors queue
///         deposits and withdrawals, which are processed at a weekly cut-off at one
///         share price. The desk borrows USDC to buy coins and repays with markup.
///         Shares cannot be transferred. All markup goes to depositors, less a
///         slice that builds the loss reserve.
/// @dev    Every USDC the vault holds is in exactly one of four counters:
///         `idle`, `queuedDeposits`, `reserve`, `claimable`. The contract never
///         reads its own token balance, so donations cannot move the share price.
contract Vault is ERC20, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotDesk();
    error NotAllowed();
    error Paused();
    error ZeroAmount();
    error TooEarly();
    error CapExceeded();
    error ManagerShareTooLow();
    error InsufficientIdle();
    error Unhealthy();
    error SharesNotTransferable();
    error OutOfBounds();
    error AlreadySet();

    event DepositRequested(address indexed user, uint256 assets, uint256 indexed epoch);
    event WithdrawRequested(address indexed user, uint256 shares, uint256 indexed epoch);
    event DepositClaimed(address indexed user, uint256 shares, uint256 refunded, uint256 indexed epoch);
    event WithdrawClaimed(address indexed user, uint256 assets, uint256 sharesReturned, uint256 indexed epoch);
    event Cutoff(uint256 indexed epoch, uint256 nav, uint256 price, uint256 depositAssets, uint256 withdrawAssets);
    event Lent(uint256 amount);
    event Repaid(uint256 principal, uint256 markup, uint256 toReserve);
    event WrittenOff(uint256 principal, uint256 fromReserve, uint256 fromFund);
    event ParamsSet(uint256 bucketCap, uint256 utilCapBps, uint256 reserveSliceBps, uint256 reserveTargetBps, uint256 managerMinBps);

    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;
    uint256 public constant PERIOD = 7 days;
    // Hard limits the admin can never exceed.
    uint256 public constant MAX_UTIL_CAP_BPS = 9_500;
    uint256 public constant MAX_RESERVE_SLICE_BPS = 5_000;
    uint256 public constant MAX_RESERVE_TARGET_BPS = 2_000;
    uint256 public constant MAX_MANAGER_MIN_BPS = 2_000;

    IERC20 public immutable usdc;
    /// The manager co-invests and must keep a minimum share of the bucket.
    address public immutable manager;
    address public desk;
    IBackstopFund public fund;
    address public guardian;

    // Parameters (admin, through the time-lock, inside the hard limits above).
    uint256 public bucketCap;
    uint256 public utilCapBps = 8_500;
    uint256 public reserveSliceBps = 1_000;
    uint256 public reserveTargetBps = 500;
    uint256 public managerMinBps = 500;
    bool public allowlistOn = true;
    bool public depositsPaused;
    mapping(address => bool) public depositorAllowed;

    // Accounting. usdc.balanceOf(this) >= idle + queuedDeposits + reserve + claimable.
    uint256 public idle; // free cash that backs the shares
    uint256 public queuedDeposits; // waiting for the next cut-off; not at risk
    uint256 public reserve; // loss reserve; not in the share price
    uint256 public claimable; // processed withdrawals and refunds, waiting to be claimed
    uint256 public lent; // principal out with the desk

    uint256 public epoch = 1;
    uint256 public nextCutoff;
    uint256 public lastNav;
    uint256 public lastPrice = WAD; // USDC per share, 18 decimals

    struct Epoch {
        uint256 depAssets; // USDC queued for deposit
        uint256 depShares; // shares minted for them at the cut-off (0 = refunded)
        uint256 wdShares; // shares queued for withdrawal
        uint256 wdBurned; // shares actually redeemed at the cut-off
        uint256 wdAssets; // USDC set aside for them
    }

    struct Request {
        uint256 amount;
        uint256 epoch;
    }

    mapping(uint256 => Epoch) public epochs;
    mapping(address => Request) public depositOf;
    mapping(address => Request) public withdrawOf;

    constructor(IERC20 usdc_, address manager_, address owner_, uint256 bucketCap_, uint256 firstCutoff, string memory name_)
        ERC20(name_, "dSHARE")
        Ownable(owner_)
    {
        usdc = usdc_;
        manager = manager_;
        bucketCap = bucketCap_;
        nextCutoff = firstCutoff;
        depositorAllowed[manager_] = true;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // ───────────────────────── Depositors ─────────────────────────

    /// Queue USDC for the next cut-off. Queued USDC is not at risk and earns nothing.
    function requestDeposit(uint256 assets) external nonReentrant {
        if (depositsPaused) revert Paused();
        if (allowlistOn && !depositorAllowed[msg.sender]) revert NotAllowed();
        if (assets == 0) revert ZeroAmount();
        _claimDeposit(msg.sender);
        if (lastNav + queuedDeposits + assets > bucketCap) revert CapExceeded();

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        queuedDeposits += assets;
        epochs[epoch].depAssets += assets;
        depositOf[msg.sender] = Request(depositOf[msg.sender].amount + assets, epoch);
        if (!_managerShareOk()) revert ManagerShareTooLow();
        emit DepositRequested(msg.sender, assets, epoch);
    }

    /// Queue shares for redemption at the next cut-off. Never pausable.
    function requestWithdraw(uint256 shares) external nonReentrant {
        if (shares == 0) revert ZeroAmount();
        _claimWithdraw(msg.sender);
        _transfer(msg.sender, address(this), shares);
        epochs[epoch].wdShares += shares;
        withdrawOf[msg.sender] = Request(withdrawOf[msg.sender].amount + shares, epoch);
        if (msg.sender == manager && !_managerShareOk()) revert ManagerShareTooLow();
        emit WithdrawRequested(msg.sender, shares, epoch);
    }

    /// Collect shares for a processed deposit. Anyone may call for any user.
    function claimDeposit(address user) external nonReentrant {
        _claimDeposit(user);
    }

    /// Collect USDC for a processed withdrawal, and any shares that were not redeemed.
    function claimWithdraw(address user) external nonReentrant {
        _claimWithdraw(user);
    }

    function _claimDeposit(address user) internal {
        Request memory r = depositOf[user];
        if (r.amount == 0 || r.epoch >= epoch) return;
        delete depositOf[user];
        Epoch storage e = epochs[r.epoch];
        if (e.depShares == 0) {
            // The epoch could not be priced; the deposit is returned.
            claimable -= r.amount;
            usdc.safeTransfer(user, r.amount);
            emit DepositClaimed(user, 0, r.amount, r.epoch);
        } else {
            uint256 shares = r.amount * e.depShares / e.depAssets;
            _transfer(address(this), user, shares);
            emit DepositClaimed(user, shares, 0, r.epoch);
        }
    }

    function _claimWithdraw(address user) internal {
        Request memory r = withdrawOf[user];
        if (r.amount == 0 || r.epoch >= epoch) return;
        delete withdrawOf[user];
        Epoch storage e = epochs[r.epoch];
        uint256 assets = r.amount * e.wdAssets / e.wdShares;
        uint256 sharesBack = r.amount * (e.wdShares - e.wdBurned) / e.wdShares;
        if (sharesBack > 0) _transfer(address(this), user, sharesBack);
        if (assets > 0) {
            claimable -= assets;
            usdc.safeTransfer(user, assets);
        }
        emit WithdrawClaimed(user, assets, sharesBack, r.epoch);
    }

    // ───────────────────────── Cut-off ─────────────────────────

    /// Price the shares and process the queues. Anyone may call once it is due.
    function cutoff() external nonReentrant {
        if (block.timestamp < nextCutoff) revert TooEarly();
        Epoch storage e = epochs[epoch];

        uint256 nav = navNow();
        uint256 supply = totalSupply();
        uint256 price = supply == 0 ? WAD : nav * WAD / supply;

        // Deposits first, so their cash can pay this cut-off's withdrawals.
        uint256 dep = e.depAssets;
        if (dep > 0) {
            queuedDeposits -= dep;
            uint256 shares = price == 0 ? 0 : dep * WAD / price;
            if (shares == 0) {
                claimable += dep; // refunded on claim
            } else {
                idle += dep;
                e.depShares = shares;
                _mint(address(this), shares);
            }
        }

        // Withdrawals: in full if cash allows, otherwise everyone in the same proportion.
        uint256 assetsOut;
        if (e.wdShares > 0) {
            uint256 need = e.wdShares * price / WAD;
            uint256 burned = need <= idle ? e.wdShares : e.wdShares * idle / need;
            assetsOut = burned * price / WAD;
            idle -= assetsOut;
            claimable += assetsOut;
            e.wdBurned = burned;
            e.wdAssets = assetsOut;
            _burn(address(this), burned);
        }

        lastNav = nav + (e.depShares > 0 ? dep : 0) - assetsOut;
        lastPrice = price;
        emit Cutoff(epoch, nav, price, dep, assetsOut);

        epoch += 1;
        nextCutoff += PERIOD;
        if (nextCutoff <= block.timestamp) nextCutoff = block.timestamp + PERIOD;
    }

    /// Net asset value: idle cash, live tickets at the lower of settlement amount and
    /// coin value, plus the reserve up to the shortfalls already visible.
    function navNow() public view returns (uint256) {
        (uint256 book, uint256 shortfall) = desk == address(0) ? (0, 0) : IDeskBook(desk).bookValue();
        return idle + book + (reserve < shortfall ? reserve : shortfall);
    }

    // ───────────────────────── Desk ─────────────────────────

    modifier onlyDesk() {
        if (msg.sender != desk) revert NotDesk();
        _;
    }

    /// Send USDC to the desk to buy a coin.
    function lend(uint256 amount) external onlyDesk {
        if (amount > idle) revert InsufficientIdle();
        idle -= amount;
        lent += amount;
        usdc.safeTransfer(desk, amount);
        emit Lent(amount);
    }

    /// Take a payment from the desk. A slice of markup builds the loss reserve.
    function repay(uint256 principal, uint256 markup) external onlyDesk {
        usdc.safeTransferFrom(desk, address(this), principal + markup);
        lent -= principal;
        uint256 slice;
        uint256 target = reserveTarget();
        if (reserve < target) {
            slice = markup * reserveSliceBps / BPS;
            if (slice > target - reserve) slice = target - reserve;
        }
        reserve += slice;
        idle += principal + markup - slice;
        emit Repaid(principal, markup, slice);
    }

    /// Record principal that will never come back. The loss reserve pays first, then
    /// the backstop fund. Whatever is left uncovered lowers the share price.
    function writeOff(uint256 principal) external onlyDesk {
        lent -= principal;
        uint256 fromReserve = principal < reserve ? principal : reserve;
        reserve -= fromReserve;
        idle += fromReserve;

        uint256 fromFund;
        uint256 rest = principal - fromReserve;
        if (rest > 0 && address(fund) != address(0)) {
            // A failing fund must never block a settlement.
            uint256 before = usdc.balanceOf(address(this));
            try fund.cover(rest) {} catch {}
            fromFund = usdc.balanceOf(address(this)) - before;
            if (fromFund > rest) fromFund = rest;
            idle += fromFund;
        }
        emit WrittenOff(principal, fromReserve, fromFund);
    }

    /// Reverts if a new ticket would break the utilisation cap or use cash that
    /// queued withdrawals need. The desk calls this at the end of every opening.
    function assertHealthy() external view {
        if (lent * BPS > utilCapBps * (idle + lent)) revert Unhealthy();
        if (idle < epochs[epoch].wdShares * lastPrice / WAD) revert Unhealthy();
    }

    function reserveTarget() public view returns (uint256) {
        return (idle + lent) * reserveTargetBps / BPS;
    }

    // ───────────────────────── Manager's minimum share ─────────────────────────

    /// The manager's stake (shares in hand plus queued deposit) against the bucket.
    function _managerShareOk() internal view returns (bool) {
        uint256 pendingDeposit = depositOf[manager].epoch == epoch ? depositOf[manager].amount : 0;
        uint256 stake = balanceOf(manager) * lastPrice / WAD + pendingDeposit;
        return stake * BPS >= managerMinBps * (lastNav + queuedDeposits);
    }

    // ───────────────────────── Shares cannot be transferred ─────────────────────────

    function transfer(address, uint256) public pure override returns (bool) {
        revert SharesNotTransferable();
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert SharesNotTransferable();
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert SharesNotTransferable();
    }

    // ───────────────────────── Admin (time-lock) and guardian ─────────────────────────

    function setDesk(address desk_) external onlyOwner {
        if (desk != address(0)) revert AlreadySet();
        desk = desk_;
    }

    function setFund(IBackstopFund fund_) external onlyOwner {
        fund = fund_;
    }

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
    }

    function setParams(
        uint256 bucketCap_,
        uint256 utilCapBps_,
        uint256 reserveSliceBps_,
        uint256 reserveTargetBps_,
        uint256 managerMinBps_
    ) external onlyOwner {
        if (
            utilCapBps_ > MAX_UTIL_CAP_BPS || reserveSliceBps_ > MAX_RESERVE_SLICE_BPS
                || reserveTargetBps_ > MAX_RESERVE_TARGET_BPS || managerMinBps_ > MAX_MANAGER_MIN_BPS
        ) revert OutOfBounds();
        bucketCap = bucketCap_;
        utilCapBps = utilCapBps_;
        reserveSliceBps = reserveSliceBps_;
        reserveTargetBps = reserveTargetBps_;
        managerMinBps = managerMinBps_;
        emit ParamsSet(bucketCap_, utilCapBps_, reserveSliceBps_, reserveTargetBps_, managerMinBps_);
    }

    function setAllowlist(bool on) external onlyOwner {
        allowlistOn = on;
    }

    function setDepositor(address user, bool allowed) external onlyOwner {
        depositorAllowed[user] = allowed;
    }

    /// Only new deposits can be paused. Withdrawals, claims and the cut-off cannot.
    function pauseDeposits(bool paused) external {
        if (msg.sender != owner() && !(paused && msg.sender == guardian)) revert NotAllowed();
        depositsPaused = paused;
    }
}
