// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {TaxHook} from "./token/TaxHook.sol";

/// @title StakedBackstopFund
/// @notice Mutual shortfall fund, version two. It takes the same calls as version one
///         (`receiveShare` from the desk, `cover` from a bucket) and adds staked SCR.
///
///         Money in: traders' profit share, in USDC. A fifth is set aside for the
///         treasury, 15% goes to the liquidity reserve, and the rest streams to
///         stakers over 90 days. USDC sent here directly (the pool fee's overflow)
///         is shortfall cover only.
///
///         Shortfalls: the fund pays from its USDC first, which is the direct cover
///         and whatever has not yet streamed. If that is not enough it sells staked
///         SCR in the pool, up to a cap per event and never below a floor under the
///         pool's average price. Whatever is still uncovered stays with the bucket.
///
///         Staking: anyone can stake SCR. A stake is a share of the staked SCR, so a
///         sale lowers every staker in the same proportion. Leaving takes a cooldown
///         and then a short window, so stakers cannot leave ahead of a loss. Stakes
///         cannot be transferred. Stakers are paid only in USDC.
contract StakedBackstopFund is Ownable2Step, ReentrancyGuard, IUnlockCallback {
    using SafeERC20 for IERC20;

    error NotVault();
    error NotPoolManager();
    error ZeroAddress();
    error ZeroAmount();
    error NothingStaked();
    error NoRequest();
    error CoolingDown();
    error WindowClosed();
    error OutOfBounds();
    error SaleAboveCap();

    event Staked(address indexed from, address indexed user, uint256 amount, uint256 shares);
    event UnstakeRequested(address indexed user, uint256 shares, uint256 readyAt);
    event Unstaked(address indexed user, uint256 shares, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event Received(address indexed from, uint256 amount, uint256 toTreasury, uint256 toReserve, uint256 toStakers);
    event Covered(address indexed vault, uint256 asked, uint256 paid, uint256 scrSold);
    event VaultSet(address indexed vault, bool allowed);
    event TreasurySet(address indexed treasury);
    event SaleLimitsSet(uint256 saleCapBps, uint256 maxDiscountBps);

    uint256 public constant TREASURY_BPS = 2_000;
    uint256 public constant RESERVE_BPS = 1_500;
    uint256 public constant STREAM = 90 days;
    uint256 public constant COOLDOWN = 14 days;
    uint256 public constant UNSTAKE_WINDOW = 7 days;
    uint256 public constant MAX_SALE_CAP_BPS = 3_000;
    uint256 public constant MAX_DISCOUNT_BPS = 3_000;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant PRECISION = 1e36;

    IERC20 public immutable usdc;
    IERC20 public immutable token;
    address public immutable reserve;
    IPoolManager public immutable poolManager;
    TaxHook public immutable hook;

    address public treasury;
    uint256 public treasuryAccrued;
    mapping(address => bool) public isVault;

    /// The most staked SCR one shortfall may sell.
    uint256 public saleCapBps = 3_000;
    /// How far below the pool's average price a shortfall sale may go.
    uint256 public maxDiscountBps = 1_000;

    // Stakes. `totalStaked` is counted here, so SCR sent directly changes nothing.
    uint256 public totalStaked;
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    struct Request {
        uint256 shares;
        uint256 readyAt;
    }

    mapping(address => Request) public requestOf;

    // The stream. Rates and accumulators carry 36 extra decimals, so a small stream
    // over a large stake does not round away.
    uint256 internal rateScaled; // USDC per second
    uint256 public periodFinish;
    uint256 internal lastUpdate;
    uint256 internal rewardPerShareScaled;
    uint256 internal owedScaled; // streamed to stakers and not yet claimed
    mapping(address => uint256) internal paidPerShareScaled;
    mapping(address => uint256) internal accrued;

    constructor(
        IERC20 usdc_,
        IERC20 token_,
        address treasury_,
        address reserve_,
        IPoolManager poolManager_,
        TaxHook hook_,
        address owner_
    ) Ownable(owner_) {
        if (treasury_ == address(0) || reserve_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        token = token_;
        treasury = treasury_;
        reserve = reserve_;
        poolManager = poolManager_;
        hook = hook_;
    }

    // ───────────────────────── Stakers ─────────────────────────

    function stake(uint256 amount) external {
        _stake(msg.sender, amount);
    }

    /// Stake the caller's SCR in `user`'s name. Reserve sales and airdrops are
    /// delivered this way.
    function stakeFor(address user, uint256 amount) external {
        _stake(user, amount);
    }

    function _stake(address user, uint256 amount) internal nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (user == address(0)) revert ZeroAddress();
        _accrue(user);
        uint256 shares = totalShares == 0 ? amount : amount * totalShares / totalStaked;
        if (shares == 0) revert ZeroAmount();
        totalStaked += amount;
        totalShares += shares;
        sharesOf[user] += shares;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, user, amount, shares);
    }

    /// Start the cooldown for `shares`. They stay staked, earn, and can still be sold
    /// for a shortfall until they are taken out. A new request replaces the old one.
    function requestUnstake(uint256 shares) external {
        if (shares == 0 || shares > sharesOf[msg.sender]) revert ZeroAmount();
        uint256 readyAt = block.timestamp + COOLDOWN;
        requestOf[msg.sender] = Request(shares, readyAt);
        emit UnstakeRequested(msg.sender, shares, readyAt);
    }

    /// Take out the requested shares, inside the window that follows the cooldown.
    function unstake() external nonReentrant returns (uint256 amount) {
        Request memory r = requestOf[msg.sender];
        if (r.shares == 0) revert NoRequest();
        if (block.timestamp < r.readyAt) revert CoolingDown();
        if (block.timestamp > r.readyAt + UNSTAKE_WINDOW) revert WindowClosed();
        delete requestOf[msg.sender];
        _accrue(msg.sender);

        amount = r.shares * totalStaked / totalShares;
        sharesOf[msg.sender] -= r.shares;
        totalShares -= r.shares;
        totalStaked -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, r.shares, amount);
    }

    /// Collect the USDC streamed to the caller so far.
    function claim() external nonReentrant returns (uint256 amount) {
        _accrue(msg.sender);
        amount = accrued[msg.sender];
        if (amount > 0) {
            accrued[msg.sender] = 0;
            owedScaled -= amount * PRECISION;
            usdc.safeTransfer(msg.sender, amount);
        }
        emit Claimed(msg.sender, amount);
    }

    /// SCR behind a staker's shares.
    function stakeOf(address user) external view returns (uint256) {
        return totalShares == 0 ? 0 : sharesOf[user] * totalStaked / totalShares;
    }

    /// USDC a staker could claim now.
    function earned(address user) external view returns (uint256) {
        uint256 perShare = rewardPerShareScaled;
        if (totalShares > 0) perShare += rateScaled * _elapsed() / totalShares;
        return accrued[user] + sharesOf[user] * (perShare - paidPerShareScaled[user]) / PRECISION;
    }

    // ───────────────────────── Money in ─────────────────────────

    /// Pull a profit share from the caller. Anyone may donate. The treasury's part is
    /// set aside and pulled later, so a blocked treasury can never block a ticket.
    function receiveShare(uint256 amount) external nonReentrant {
        _accrue(address(0));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 toTreasury = amount * TREASURY_BPS / BPS;
        uint256 toReserve = amount * RESERVE_BPS / BPS;
        uint256 toStakers = amount - toTreasury - toReserve;
        treasuryAccrued += toTreasury;
        if (toReserve > 0) usdc.safeTransfer(reserve, toReserve);

        // Spread what was still to come, plus the new amount, over a fresh period.
        rateScaled = (_unstreamedScaled() + toStakers * PRECISION) / STREAM;
        periodFinish = block.timestamp + STREAM;
        emit Received(msg.sender, amount, toTreasury, toReserve, toStakers);
    }

    /// Send the treasury what it has accrued.
    function claimTreasury() external {
        uint256 amount = treasuryAccrued;
        treasuryAccrued = 0;
        usdc.safeTransfer(treasury, amount);
    }

    // ───────────────────────── Shortfalls ─────────────────────────

    /// USDC available to cover shortfalls: everything except the treasury's part and
    /// what has already streamed to stakers.
    function available() public view returns (uint256) {
        uint256 owed = owedScaled;
        if (totalShares > 0) owed += rateScaled * _elapsed();
        uint256 held = treasuryAccrued + Math.ceilDiv(owed, PRECISION);
        uint256 balance = usdc.balanceOf(address(this));
        return balance > held ? balance - held : 0;
    }

    /// Pay up to `amount` to the calling vault. Returns what was paid. USDC first,
    /// then a sale of staked SCR. A failed sale pays nothing and never reverts.
    function cover(uint256 amount) external nonReentrant returns (uint256 paid) {
        if (!isVault[msg.sender]) revert NotVault();
        _accrue(address(0));

        uint256 cash = available();
        paid = amount < cash ? amount : cash;
        if (paid > 0) _takeFromStream(paid, cash);

        uint256 scrSold;
        uint256 rest = amount - paid;
        if (rest > 0 && totalStaked > 0) {
            uint256 raised;
            (scrSold, raised) = _sellStaked(rest);
            totalStaked -= scrSold;
            paid += raised < rest ? raised : rest; // any excess stays as direct cover
        }
        if (paid > 0) usdc.safeTransfer(msg.sender, paid);
        emit Covered(msg.sender, amount, paid, scrSold);
    }

    /// Direct cover is spent before the stream. What comes out of the stream lowers
    /// the rate for the rest of the period.
    function _takeFromStream(uint256 paid, uint256 cash) internal {
        uint256 unstreamedScaled = _unstreamedScaled();
        uint256 unstreamed = unstreamedScaled / PRECISION;
        uint256 direct = cash > unstreamed ? cash - unstreamed : 0;
        if (paid <= direct) return;
        uint256 fromStreamScaled = (paid - direct) * PRECISION;
        rateScaled = (unstreamedScaled > fromStreamScaled ? unstreamedScaled - fromStreamScaled : 0) / (periodFinish - block.timestamp);
    }

    /// Sell staked SCR for `need` USDC. If that would take more than the cap, sell
    /// the cap instead. The price never goes below the floor under the average.
    function _sellStaked(uint256 need) internal returns (uint256 scrSold, uint256 raised) {
        uint256 maxScr = totalStaked * saleCapBps / BPS;
        if (maxScr == 0) return (0, 0);
        uint160 limit = _priceLimit();
        try poolManager.unlock(abi.encode(true, need, maxScr, limit)) returns (bytes memory result) {
            return abi.decode(result, (uint256, uint256));
        } catch {
            try poolManager.unlock(abi.encode(false, maxScr, maxScr, limit)) returns (bytes memory result) {
                return abi.decode(result, (uint256, uint256));
            } catch {
                return (0, 0);
            }
        }
    }

    /// The square-root price at which a sale stops: the pool's average price less
    /// `maxDiscountBps`.
    function _priceLimit() internal view returns (uint160) {
        uint256 average = TickMath.getSqrtPriceAtTick(hook.twapTick());
        uint256 keep = Math.sqrt((BPS - maxDiscountBps) * 1e8); // sqrt(1 - discount), 6 decimals
        // Selling SCR moves the pool's price up when USDC is currency0, down otherwise.
        return uint160(hook.usdcIsCurrency0() ? average * 1e6 / keep : average * keep / 1e6);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (bool exactOutput, uint256 amount, uint256 maxScr, uint160 limit) =
            abi.decode(data, (bool, uint256, uint256, uint160));
        bool usdcFirst = hook.usdcIsCurrency0();
        PoolKey memory key = hook.canonicalPoolKey();

        BalanceDelta delta = poolManager.swap(
            key, IPoolManager.SwapParams(!usdcFirst, exactOutput ? int256(amount) : -int256(amount), limit), ""
        );
        (int128 usdcDelta, int128 scrDelta) =
            usdcFirst ? (delta.amount0(), delta.amount1()) : (delta.amount1(), delta.amount0());
        uint256 scrIn = uint256(uint128(-scrDelta));
        uint256 usdcOut = uint256(uint128(usdcDelta));
        if (scrIn > maxScr) revert SaleAboveCap();

        if (scrIn > 0) {
            poolManager.sync(Currency.wrap(address(token)));
            token.safeTransfer(address(poolManager), scrIn);
            poolManager.settle();
        }
        if (usdcOut > 0) poolManager.take(Currency.wrap(address(usdc)), address(this), usdcOut);
        return abi.encode(scrIn, usdcOut);
    }

    // ───────────────────────── Stream accounting ─────────────────────────

    function _elapsed() internal view returns (uint256) {
        uint256 until = block.timestamp < periodFinish ? block.timestamp : periodFinish;
        return until > lastUpdate ? until - lastUpdate : 0;
    }

    function _unstreamedScaled() internal view returns (uint256) {
        return block.timestamp < periodFinish ? rateScaled * (periodFinish - block.timestamp) : 0;
    }

    /// Bring the stream up to now, and settle `user` if one is given. While nobody is
    /// staked, what streams is owed to nobody and stays as cover.
    function _accrue(address user) internal {
        if (totalShares > 0) {
            uint256 streamedScaled = rateScaled * _elapsed();
            rewardPerShareScaled += streamedScaled / totalShares;
            owedScaled += streamedScaled;
        }
        lastUpdate = block.timestamp;
        if (user != address(0)) {
            accrued[user] += sharesOf[user] * (rewardPerShareScaled - paidPerShareScaled[user]) / PRECISION;
            paidPerShareScaled[user] = rewardPerShareScaled;
        }
    }

    // ───────────────────────── Admin (time-lock) ─────────────────────────

    function setVault(address vault, bool allowed) external onlyOwner {
        isVault[vault] = allowed;
        emit VaultSet(vault, allowed);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setSaleLimits(uint256 saleCapBps_, uint256 maxDiscountBps_) external onlyOwner {
        if (saleCapBps_ > MAX_SALE_CAP_BPS || maxDiscountBps_ > MAX_DISCOUNT_BPS) revert OutOfBounds();
        saleCapBps = saleCapBps_;
        maxDiscountBps = maxDiscountBps_;
        emit SaleLimitsSet(saleCapBps_, maxDiscountBps_);
    }
}
