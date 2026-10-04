// SPDX-License-Identifier: MIT
// Adapted from Standard Reserve's verified TaxHook on Robinhood Chain
// (0xF1eE073811B14359D850825E48d200483200eDcd), MIT licensed. Re-denominated from native ETH to
// USDC, and trimmed: the epoch net-flow windows, the tick reservation and the central-bank
// bindings are removed.
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary, toBalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SafeCast} from "v4-core/src/libraries/SafeCast.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {AddressRegistry} from "./AddressRegistry.sol";
import {SacredTokenDummy} from "./SacredTokenDummy.sol";
import {Keys} from "./libraries/Keys.sol";

/// @title TaxHook
/// @notice Uniswap v4 hook for the canonical USDC/SCR pool. It taxes trades in
///         USDC and passes the proceeds to the liquidity reserve.
///
///         - Trading taxes, denominated in USDC. Rates open at the deploy-set
///           launch values and decay to the floors over an immutable window
///           anchored at pool initialization. The schedule's start rates are
///           exempt from the 10% cap; `setTaxes` overrides and retires the
///           schedule and is capped at 5% per side. Taxes are held here and
///           pushed to the fee splitter by the permissionless `forwardTaxes`,
///           so a splitter fault cannot block swaps.
///         - A time-weighted average tick, which the reserve sale uses as its
///           market price.
///         - The backstop fund's swaps are exempt: when it sells staked SCR to
///           cover a shortfall, the proceeds go to the bucket in full.
///         - Third-party liquidity: a range position is a limit order that
///           fills without crossing the swap path, so it would let a holder
///           exit at the taxed takers' expense with no tax of its own. While
///           the launch schedule is live, only the POL manager may add
///           liquidity; once it has decayed (or been retired by `setTaxes`),
///           anyone may. Non-POL withdrawals of principal are taxed at the
///           live rates on each side: USDC at the sell rate, SCR at the buy
///           rate (burned). Accrued LP fees are not taxed.
///         - Venue gate reporter: the token only lets SCR move to or from the
///           PoolManager up to what this hook has authorized in the
///           transaction, so every canonical swap and liquidity change
///           reports its SCR leg from the after-callbacks, before the router
///           settles. Other v4 pools do not run this hook and cannot settle.
///
///         Tax mechanics: the rate applies to the gross USDC leg (what the
///         user pays on a buy, what the pool pays out on a sell) regardless of
///         swap shape. Exact-input shapes tax that leg directly. Exact-output
///         shapes know only the net leg, so their fee is grossed up
///         (net * r / (1 - r)) to the same effective rate. When USDC is the
///         specified currency (exact-input buys, exact-output sells),
///         `beforeSwap` adjusts the specified delta from the requested amount
///         and `afterSwap` verifies the pool filled that leg in full; a
///         price-limited partial fill would otherwise be taxed on the
///         requested amount, so it reverts. When USDC is the unspecified
///         currency, `afterSwap` taxes the realized amount and returns an
///         unspecified delta. In both paths the fee is realized with `take`
///         inside the callback, per the v4-core fee-taking pattern.
///
///         USDC and SCR sort by address, so either may be currency0. The
///         order is fixed at deploy in `usdcIsCurrency0`.
contract TaxHook is Ownable2Step {
    using PoolIdLibrary for PoolKey;
    using SafeCast for uint256;
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;

    uint256 public constant TAX_DENOMINATOR = 10_000;
    /// @notice Per-side ceiling on manual tax rates: 5%.
    uint256 public constant TAX_CAP_BPS = 500;

    /// @notice Launch tax schedule. Rates open at the start values and decay
    ///         to the floors over `duration`, anchored at pool initialization,
    ///         with no admin input. With `halfLife` set, the excess over the
    ///         floor halves every `halfLife` seconds and snaps to the floor at
    ///         the end of the window; with it zero, the decay is linear.
    ///         `setTaxes` overrides the schedule at any time.
    /// @dev Set once at deploy and immutable thereafter, so the admin cannot
    ///      stretch the duration or lift the floor later.
    struct TaxSchedule {
        uint256 startBuyBps;
        uint256 startSellBps;
        uint256 floorBuyBps;
        uint256 floorSellBps;
        uint256 duration;
        uint256 halfLife; // seconds; zero = linear decay
    }

    uint256 private constant WAD = 1e18;

    uint256 public immutable decayStartBuyBps;
    uint256 public immutable decayStartSellBps;
    uint256 public immutable decayFloorBuyBps;
    uint256 public immutable decayFloorSellBps;
    uint256 public immutable taxDecayDuration;
    uint256 public immutable taxHalfLife;
    /// @notice TWAP checkpoint rotation period; the reference averages over
    ///         one-to-two windows of trailing time.
    uint256 public constant TWAP_WINDOW = 30 minutes;

    IPoolManager public immutable poolManager;
    address public immutable sacred;
    address public immutable usdc;
    /// @notice True when USDC sorts below SCR and is the pool's currency0.
    bool public immutable usdcIsCurrency0;
    /// @notice Resolves the POL manager (`Keys.POL_MANAGER`) and the splitter
    ///         that receives the taxes (`Keys.FEE_SPLITTER`).
    AddressRegistry public immutable registry;

    /// @notice The one pool this hook serves; set at initialization.
    PoolKey public poolKey;
    bool public poolInitialized;

    /// @notice Timestamp of pool initialization, when the decay clock started.
    ///         Zero until the pool is live, during which the start rates apply.
    uint256 public taxDecayStart;
    /// @notice Set by the first `setTaxes` call and never cleared. Once true,
    ///         the schedule is retired and the stored rates below govern.
    bool public taxOverridden;

    /// @dev Manual rates, consulted only once `taxOverridden` is set.
    uint256 public buyTaxBps;
    uint256 public sellTaxBps;

    // Time-weighted tick state: a running cumulative plus two rotating
    // checkpoints, giving a 1x-2x TWAP_WINDOW lookback.
    int24 public lastTick;
    uint256 public lastTickTime;
    int256 public tickCumulative;
    uint256 public windowStart;
    int256 public windowStartCumulative;
    uint256 public prevWindowStart;
    int256 public prevWindowStartCumulative;

    event TaxesUpdated(uint256 buyTaxBps, uint256 sellTaxBps);
    event TaxCollected(bool isBuy, uint256 amount);
    event LpTaxCollected(address indexed sender, uint256 usdcAmount, uint256 tokenAmount);
    event TaxesForwarded(address indexed to, uint256 amount);

    error NotPoolManager();
    error NotPolManager();
    error NotCanonicalPool();
    error AlreadyInitialized();
    /// @notice Only the POL manager may add liquidity while the launch tax
    ///         schedule is live; retry once it has decayed to the floor.
    error LpDepositsClosedDuringLaunch();
    error TaxAboveCap();
    error InvalidTaxSchedule();
    error InvalidPair();
    error NoFeeSplitter();
    /// @notice A USDC-specified swap stopped at its price limit before
    ///         filling the leg the tax was sized on. Swap at the extreme
    ///         limit and bound slippage by minimum output instead.
    error PartialFillUnsupported();

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(
        IPoolManager poolManager_,
        address sacred_,
        address usdc_,
        AddressRegistry registry_,
        address initialOwner,
        TaxSchedule memory schedule
    ) Ownable(initialOwner) {
        // The start rates are exempt from the cap: the schedule is immutable
        // and decays mechanically, so a hot open carries no discretion. The
        // floors, where manual control begins, must sit within the cap that
        // binds `setTaxes`.
        if (
            schedule.duration == 0 || schedule.startBuyBps >= TAX_DENOMINATOR
                || schedule.startSellBps >= TAX_DENOMINATOR || schedule.floorBuyBps > TAX_CAP_BPS
                || schedule.floorSellBps > TAX_CAP_BPS || schedule.floorBuyBps > schedule.startBuyBps
                || schedule.floorSellBps > schedule.startSellBps
        ) revert InvalidTaxSchedule();
        if (usdc_ == address(0) || sacred_ == address(0) || usdc_ == sacred_) revert InvalidPair();

        poolManager = poolManager_;
        sacred = sacred_;
        usdc = usdc_;
        usdcIsCurrency0 = usdc_ < sacred_;
        registry = registry_;

        decayStartBuyBps = schedule.startBuyBps;
        decayStartSellBps = schedule.startSellBps;
        decayFloorBuyBps = schedule.floorBuyBps;
        decayFloorSellBps = schedule.floorSellBps;
        taxDecayDuration = schedule.duration;
        taxHalfLife = schedule.halfLife;

        // Manual rates are seeded at the schedule floors so an override that
        // lands before the schedule is consulted never reads zero, and the
        // seeded values are already within the cap.
        buyTaxBps = schedule.floorBuyBps;
        sellTaxBps = schedule.floorSellBps;
    }

    // ------------------------------------------------------------------
    // Hook callbacks
    // ------------------------------------------------------------------

    /// @dev Locks the hook to a single pool, USDC / SCR, initialized by the
    ///      POL manager. Seeds the TWAP state from the initial price.
    function beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96)
        external
        onlyPoolManager
        returns (bytes4)
    {
        if (poolInitialized) revert AlreadyInitialized();
        (address expected0, address expected1) = usdcIsCurrency0 ? (usdc, sacred) : (sacred, usdc);
        if (Currency.unwrap(key.currency0) != expected0 || Currency.unwrap(key.currency1) != expected1) {
            revert NotCanonicalPool();
        }
        if (sender != registry.get(Keys.POL_MANAGER)) revert NotPolManager();
        poolInitialized = true;
        poolKey = key;
        taxDecayStart = block.timestamp; // decay clock runs from go-live

        lastTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);
        lastTickTime = block.timestamp;
        windowStart = block.timestamp;
        prevWindowStart = block.timestamp;
        return IHooks.beforeInitialize.selector;
    }

    /// @dev Charges the tax when USDC is the specified currency. A positive
    ///      specified delta shrinks an exact-input buy's pool leg (the user pays
    ///      the stated USDC, fee taken off the top) and grows an exact-output
    ///      sell's pool leg (the user receives the stated USDC, fee taken from
    ///      the extra output, grossed up so the rate holds on the whole leg the
    ///      pool pays).
    function beforeSwap(address sender, PoolKey calldata, IPoolManager.SwapParams calldata params, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (!_specifiedIsUsdc(params) || _exempt(sender)) {
            return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        bool isBuy = _isBuy(params);
        uint256 fee = _specifiedLegFee(params, isBuy);
        if (fee == 0) {
            return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        poolManager.take(Currency.wrap(usdc), address(this), fee);
        emit TaxCollected(isBuy, fee);
        return (IHooks.beforeSwap.selector, toBeforeSwapDelta(fee.toInt128(), 0), 0);
    }

    /// @dev Charges the tax when USDC is the unspecified currency and
    ///      advances the TWAP accumulator. `delta`
    ///      holds the pool-crossing amounts before hook adjustments, so its
    ///      USDC side is the tax-exclusive gross. For USDC-specified swaps it
    ///      instead confirms the pool moved the leg `beforeSwap` sized the fee
    ///      on.
    function afterSwap(
        address sender,
        PoolKey calldata,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        (int128 usdcDelta, int128 tokenDelta) = _split(delta);
        _authorizeTokenLeg(tokenDelta);
        _observeTick();
        if (_exempt(sender)) return (IHooks.afterSwap.selector, 0);

        uint256 usdcAmount = _abs(usdcDelta);
        bool isBuy = _isBuy(params);
        if (_specifiedIsUsdc(params)) {
            // Taxed in beforeSwap on the requested amount. The pool leg it
            // committed to is requested - fee for a buy and requested + fee for
            // a sell; anything else is a price-limited partial fill the fee no
            // longer matches.
            uint256 requested = _abs(params.amountSpecified);
            uint256 fee = _specifiedLegFee(params, isBuy);
            uint256 expected = isBuy ? requested - fee : requested + fee;
            if (usdcAmount != expected) revert PartialFillUnsupported();
            return (IHooks.afterSwap.selector, 0);
        }

        // USDC is the unspecified leg: the realized amount is what the pool
        // moved, so a partial fill is taxed on what executed. An exact-output
        // buy sees the net leg and is grossed up; an exact-input sell sees the
        // pool's gross payout.
        uint256 realizedFee = isBuy ? _grossedUpFee(usdcAmount, true) : _feeOnGross(usdcAmount, false);
        if (realizedFee == 0) {
            return (IHooks.afterSwap.selector, 0);
        }

        poolManager.take(Currency.wrap(usdc), address(this), realizedFee);
        emit TaxCollected(isBuy, realizedFee);
        return (IHooks.afterSwap.selector, realizedFee.toInt128());
    }

    /// @dev Launch gate: while the schedule is live, a range position is the
    ///      cheapest way around the launch taxes (a limit sell fills at 0%
    ///      instead of the launch sell rate), so non-POL adds are refused
    ///      until the rates reach their floors. Only positive deltas reach
    ///      this callback.
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external view onlyPoolManager returns (bytes4) {
        if (sender != registry.get(Keys.POL_MANAGER) && launchScheduleActive()) {
            revert LpDepositsClosedDuringLaunch();
        }
        return IHooks.beforeAddLiquidity.selector;
    }

    /// @dev Authorizes the deposit's SCR leg with the token before the router
    ///      settles it. Nothing else happens here.
    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta delta,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BalanceDelta) {
        (, int128 tokenDelta) = _split(delta);
        _authorizeTokenLeg(tokenDelta);
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    /// @dev Taxes non-POL principal on the way out, closing the range-order
    ///      route around the swap tax. Withdrawn USDC is a completed sell and
    ///      pays the sell rate; withdrawn SCR is a completed buy and pays the
    ///      buy rate, burned on receipt (the hook does not hold the token).
    ///      `delta` is principal plus the fees the singleton realizes on every
    ///      modification; only the principal is taxed, so a zero-liquidity fee
    ///      claim pays nothing. The POL position is exempt.
    function afterRemoveLiquidity(
        address sender,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta delta,
        BalanceDelta feesAccrued,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BalanceDelta) {
        // The whole SCR leg leaves the PoolManager: the withdrawer's net
        // through the router, and the tax through this hook's own take.
        (int128 usdcDelta, int128 tokenDelta) = _split(delta);
        _authorizeTokenLeg(tokenDelta);
        if (sender == registry.get(Keys.POL_MANAGER)) {
            return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        }

        (int128 usdcFees, int128 tokenFees) = _split(feesAccrued);
        uint256 usdcFee = _feeOnGross(_nonNegative(usdcDelta - usdcFees), false);
        uint256 tokenFee = _feeOnGross(_nonNegative(tokenDelta - tokenFees), true);
        if (usdcFee == 0 && tokenFee == 0) {
            return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        }

        if (usdcFee > 0) poolManager.take(Currency.wrap(usdc), address(this), usdcFee);
        if (tokenFee > 0) {
            poolManager.take(Currency.wrap(sacred), address(this), tokenFee);
            SacredTokenDummy(sacred).burn(tokenFee);
        }
        emit LpTaxCollected(sender, usdcFee, tokenFee);
        (int128 fee0, int128 fee1) =
            usdcIsCurrency0 ? (usdcFee.toInt128(), tokenFee.toInt128()) : (tokenFee.toInt128(), usdcFee.toInt128());
        return (IHooks.afterRemoveLiquidity.selector, toBalanceDelta(fee0, fee1));
    }

    /// @dev Reports a canonical operation's SCR leg to the token's venue
    ///      gate. A negative delta is SCR the PoolManager is owed (settled
    ///      inbound); a positive one is SCR it will pay out.
    function _authorizeTokenLeg(int128 tokenDelta) internal {
        if (tokenDelta == 0) return;
        bool inbound = tokenDelta < 0;
        SacredTokenDummy(sacred).authorizePoolManagerTransfer(inbound, _abs(tokenDelta));
    }

    /// @dev The backstop fund trades without the fee.
    function _exempt(address sender) internal view returns (bool) {
        return sender == registry.get(Keys.BACKSTOP_FUND);
    }

    /// @dev A buy pays USDC into the pool.
    function _isBuy(IPoolManager.SwapParams calldata params) internal view returns (bool) {
        return params.zeroForOne == usdcIsCurrency0;
    }

    /// @dev The specified currency is the input of an exact-input swap and
    ///      the output of an exact-output one.
    function _specifiedIsUsdc(IPoolManager.SwapParams calldata params) internal view returns (bool) {
        bool specifiedIsCurrency0 = params.zeroForOne == (params.amountSpecified < 0);
        return specifiedIsCurrency0 == usdcIsCurrency0;
    }

    function _split(BalanceDelta delta) internal view returns (int128 usdcDelta, int128 tokenDelta) {
        return usdcIsCurrency0 ? (delta.amount0(), delta.amount1()) : (delta.amount1(), delta.amount0());
    }

    /// @dev Fee for a USDC-specified swap from its requested amount: an
    ///      exact-input buy states the gross leg, an exact-output sell states
    ///      the net leg.
    function _specifiedLegFee(IPoolManager.SwapParams calldata params, bool isBuy) internal view returns (uint256) {
        uint256 requested = _abs(params.amountSpecified);
        return isBuy ? _feeOnGross(requested, true) : _grossedUpFee(requested, false);
    }

    /// @dev Rate applied to a gross USDC leg.
    function _feeOnGross(uint256 gross, bool isBuy) internal view returns (uint256) {
        return gross * currentTaxBps(isBuy) / TAX_DENOMINATOR;
    }

    /// @dev Fee on top of a net USDC leg such that fee / (net + fee) equals the
    ///      rate: net * r / (1 - r). The schedule forbids r = 100%.
    function _grossedUpFee(uint256 net, bool isBuy) internal view returns (uint256) {
        uint256 rate = currentTaxBps(isBuy);
        return net * rate / (TAX_DENOMINATOR - rate);
    }

    function _abs(int256 x) internal pure returns (uint256) {
        return x < 0 ? uint256(-x) : uint256(x);
    }

    function _nonNegative(int128 amount) internal pure returns (uint256) {
        return amount > 0 ? uint256(uint128(amount)) : 0;
    }

    // ------------------------------------------------------------------
    // Tax administration and forwarding
    // ------------------------------------------------------------------

    /// @notice True while the launch schedule governs the rates: not yet
    ///         retired by `setTaxes` and not yet decayed to the floor.
    ///         Third-party liquidity opens once this turns false.
    function launchScheduleActive() public view returns (bool) {
        if (taxOverridden) return false;
        if (taxDecayStart == 0) return true;
        return block.timestamp < taxDecayStart + taxDecayDuration;
    }

    /// @notice The live per-side tax rate: the launch decay until the owner
    ///         overrides, the stored manual rates afterwards.
    function currentTaxBps(bool isBuy) public view returns (uint256) {
        if (taxOverridden) return isBuy ? buyTaxBps : sellTaxBps;
        uint256 start = isBuy ? decayStartBuyBps : decayStartSellBps;
        uint256 floor = isBuy ? decayFloorBuyBps : decayFloorSellBps;
        uint256 anchor = taxDecayStart;
        if (anchor == 0) return start; // pool not yet initialized
        uint256 elapsed = block.timestamp - anchor;
        if (elapsed >= taxDecayDuration) return floor;
        uint256 halfLife = taxHalfLife;
        if (halfLife == 0) return start - (start - floor) * elapsed / taxDecayDuration;
        // Excess over the floor halves every `halfLife`: 0.5^(elapsed / halfLife).
        uint256 remainingWad = uint256(FixedPointMathLib.powWad(int256(WAD / 2), int256(elapsed * WAD / halfLife)));
        return floor + (start - floor) * remainingWad / WAD;
    }

    /// @notice Sets both tax rates, effective immediately and capped at 10%
    ///         per side. The first call permanently retires the launch decay
    ///         schedule.
    function setTaxes(uint256 buyBps, uint256 sellBps) external onlyOwner {
        if (buyBps > TAX_CAP_BPS || sellBps > TAX_CAP_BPS) revert TaxAboveCap();
        taxOverridden = true;
        buyTaxBps = buyBps;
        sellTaxBps = sellBps;
        emit TaxesUpdated(buyBps, sellBps);
    }

    /// @notice Pushes every USDC held here to the fee splitter. Permissionless
    ///         and separate from the swap path so a splitter failure cannot
    ///         block trading.
    function forwardTaxes() external {
        address splitter = registry.get(Keys.FEE_SPLITTER);
        if (splitter == address(0)) revert NoFeeSplitter();
        uint256 amount = IERC20(usdc).balanceOf(address(this));
        IERC20(usdc).safeTransfer(splitter, amount);
        emit TaxesForwarded(splitter, amount);
    }

    // ------------------------------------------------------------------
    // Time-weighted tick reference (reserve sale price)
    // ------------------------------------------------------------------

    /// @dev Advances the cumulative and rotates the window checkpoints. Runs on
    ///      every swap.
    function _observeTick() internal {
        tickCumulative += int256(lastTick) * int256(block.timestamp - lastTickTime);
        lastTickTime = block.timestamp;
        (, int24 tick,,) = poolManager.getSlot0(poolKey.toId());
        lastTick = tick;

        if (block.timestamp - windowStart >= TWAP_WINDOW) {
            prevWindowStart = windowStart;
            prevWindowStartCumulative = windowStartCumulative;
            windowStart = block.timestamp;
            windowStartCumulative = tickCumulative;
        }
    }

    /// @notice Time-weighted average tick over the trailing one to two TWAP
    ///         windows (the span depends on checkpoint rotation).
    function twapTick() public view returns (int24) {
        uint256 elapsed = twapSpan();
        if (elapsed == 0) return lastTick;
        int256 cumNow = tickCumulative + int256(lastTick) * int256(block.timestamp - lastTickTime);
        return int24((cumNow - prevWindowStartCumulative) / int256(elapsed));
    }

    /// @notice Seconds of history behind `twapTick`.
    function twapSpan() public view returns (uint256) {
        return block.timestamp - prevWindowStart;
    }

    /// @notice The canonical pool's key as a struct (the auto-generated
    ///         `poolKey()` getter flattens it).
    function canonicalPoolKey() external view returns (PoolKey memory) {
        return poolKey;
    }
}
