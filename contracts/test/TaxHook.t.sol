// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {CustomRevert} from "v4-core/src/libraries/CustomRevert.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {TaxHook} from "../src/token/TaxHook.sol";
import {SacredTokenDummy} from "../src/token/SacredTokenDummy.sol";
import {AddressRegistry} from "../src/token/AddressRegistry.sol";
import {Keys} from "../src/token/libraries/Keys.sol";
import {MockERC20} from "../src/mocks/Mocks.sol";

/// Minimal v4 router: runs one swap or liquidity change and settles both
/// currencies against the caller.
contract V4Router is IUnlockCallback {
    IPoolManager internal immutable manager;

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external {
        manager.initialize(key, sqrtPriceX96);
    }

    function swap(PoolKey memory key, IPoolManager.SwapParams memory params) external returns (BalanceDelta delta) {
        (delta,) =
            abi.decode(manager.unlock(abi.encode(msg.sender, key, true, abi.encode(params))), (BalanceDelta, BalanceDelta));
    }

    function modifyLiquidity(PoolKey memory key, IPoolManager.ModifyLiquidityParams memory params)
        external
        returns (BalanceDelta delta, BalanceDelta fees)
    {
        return
            abi.decode(manager.unlock(abi.encode(msg.sender, key, false, abi.encode(params))), (BalanceDelta, BalanceDelta));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "not manager");
        (address payer, PoolKey memory key, bool isSwap, bytes memory inner) =
            abi.decode(data, (address, PoolKey, bool, bytes));
        BalanceDelta delta;
        BalanceDelta fees;
        if (isSwap) {
            delta = manager.swap(key, abi.decode(inner, (IPoolManager.SwapParams)), "");
        } else {
            (delta, fees) = manager.modifyLiquidity(key, abi.decode(inner, (IPoolManager.ModifyLiquidityParams)), "");
        }
        _settle(key.currency0, payer, delta.amount0());
        _settle(key.currency1, payer, delta.amount1());
        return abi.encode(delta, fees);
    }

    function _settle(Currency currency, address payer, int128 amount) internal {
        if (amount < 0) {
            manager.sync(currency);
            IERC20(Currency.unwrap(currency)).transferFrom(payer, address(manager), uint128(-amount));
            manager.settle();
        } else if (amount > 0) {
            manager.take(currency, payer, uint128(amount));
        }
    }
}

/// Shared fixture: a USDC/SCR pool at 0.10 USDC per SCR, seeded by the POL
/// manager, with the launch schedule decaying 20%/30% to 2%/3% over an hour.
/// The test contract stands in for the central bank, the token's only minter.
abstract contract TaxHookTest is Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint256 internal constant USDC = 1e6;
    uint256 internal constant SCR = 1e18;
    uint256 internal constant START_BUY = 2_000;
    uint256 internal constant START_SELL = 3_000;
    uint256 internal constant FLOOR_BUY = 200;
    uint256 internal constant FLOOR_SELL = 300;
    uint256 internal constant DURATION = 1 hours;
    uint256 internal constant HALF_LIFE = 10 minutes;
    int24 internal constant SPACING = 60;

    uint160 internal constant HOOK_FLAGS = Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
        | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG
        | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        | Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;

    address internal admin = makeAddr("admin");
    address internal reserve = makeAddr("reserve");
    address internal treasury = makeAddr("treasury"); // funds the protocol-owned liquidity
    address internal trader = makeAddr("trader");
    address internal lp = makeAddr("lp");

    PoolManager internal manager;
    AddressRegistry internal registry;
    SacredTokenDummy internal token;
    MockERC20 internal usdc;
    TaxHook internal hook;
    V4Router internal pol;
    V4Router internal router;
    PoolKey internal key;
    bool internal usdcFirst;

    /// Where the USDC mock lives, which decides the pool's currency order.
    function _usdcAddress() internal pure virtual returns (address);

    /// The token reads the bank's owner for its admin switches.
    function owner() external view returns (address) {
        return address(this);
    }

    function setUp() public virtual {
        vm.warp(1_760_000_000);
        manager = new PoolManager(address(this));
        registry = new AddressRegistry(address(this));
        token = new SacredTokenDummy(address(this), registry, address(manager));
        deployCodeTo("Mocks.sol:MockERC20", abi.encode("USD Coin", "USDC", uint8(6)), _usdcAddress());
        usdc = MockERC20(_usdcAddress());
        usdcFirst = address(usdc) < address(token);

        hook = _deployHook(0x4444);
        pol = new V4Router(manager);
        router = new V4Router(manager);
        registry.set(Keys.TAX_HOOK, address(hook));
        registry.set(Keys.POL_MANAGER, address(pol));
        registry.set(Keys.FEE_SPLITTER, reserve);

        _fund(treasury, 200_000 * USDC, 2_000_000 * SCR);
        _fund(trader, 10_000 * USDC, 100_000 * SCR);
        _fund(lp, 10_000 * USDC, 100_000 * SCR);

        key = _key(IHooks(address(hook)));
        pol.initialize(key, _sqrtPrice());
        vm.prank(treasury);
        pol.modifyLiquidity(key, _fullRange(3e17)); // about 95,000 USDC and 950,000 SCR
    }

    function _deployHook(uint160 prefix) internal returns (TaxHook) {
        address where = address((prefix << 144) | HOOK_FLAGS);
        TaxHook.TaxSchedule memory schedule =
            TaxHook.TaxSchedule(START_BUY, START_SELL, FLOOR_BUY, FLOOR_SELL, DURATION, HALF_LIFE);
        deployCodeTo("TaxHook.sol:TaxHook", abi.encode(manager, token, usdc, registry, admin, schedule), where);
        return TaxHook(where);
    }

    function _fund(address who, uint256 usdcAmount, uint256 scrAmount) internal {
        usdc.mint(who, usdcAmount);
        token.mint(who, scrAmount);
        vm.startPrank(who);
        usdc.approve(address(pol), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        token.approve(address(pol), type(uint256).max);
        token.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function _key(IHooks hooks) internal view returns (PoolKey memory) {
        (address c0, address c1) = usdcFirst ? (address(usdc), address(token)) : (address(token), address(usdc));
        return PoolKey(Currency.wrap(c0), Currency.wrap(c1), 3000, SPACING, hooks);
    }

    /// 0.10 USDC per SCR is 1e13 raw SCR per raw USDC.
    function _sqrtPrice() internal view returns (uint160) {
        uint256 ratioX192 = usdcFirst ? uint256(1e13) << 192 : (uint256(1) << 192) / 1e13;
        return uint160(FixedPointMathLib.sqrt(ratioX192));
    }

    function _fullRange(int256 liquidity) internal pure returns (IPoolManager.ModifyLiquidityParams memory) {
        return IPoolManager.ModifyLiquidityParams(
            TickMath.minUsableTick(SPACING), TickMath.maxUsableTick(SPACING), liquidity, bytes32(0)
        );
    }

    function _params(bool isBuy, int256 amountSpecified) internal view returns (IPoolManager.SwapParams memory) {
        bool zeroForOne = isBuy == usdcFirst;
        return IPoolManager.SwapParams(
            zeroForOne, amountSpecified, zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        );
    }

    function _swap(bool isBuy, int256 amountSpecified) internal {
        vm.prank(trader);
        router.swap(key, _params(isBuy, amountSpecified));
    }

    function _pastLaunch() internal {
        vm.warp(block.timestamp + DURATION);
    }

    /// How v4 reports a revert raised inside a hook callback.
    function _hookRevert(bytes4 callback, bytes4 reason) internal view returns (bytes memory) {
        return abi.encodeWithSelector(
            CustomRevert.WrappedError.selector,
            address(hook),
            callback,
            abi.encodeWithSelector(reason),
            abi.encodeWithSelector(Hooks.HookCallFailed.selector)
        );
    }

    // ---- initialization ----

    function test_poolIsBoundAtInitialization() public view {
        assertTrue(hook.poolInitialized());
        assertEq(hook.usdcIsCurrency0(), usdcFirst);
        assertEq(hook.taxDecayStart(), block.timestamp);
        assertEq(address(hook.canonicalPoolKey().hooks), address(hook));
    }

    function test_secondPoolOnTheHookReverts() public {
        PoolKey memory other = _key(IHooks(address(hook)));
        other.fee = 500;
        vm.expectRevert();
        pol.initialize(other, _sqrtPrice());
    }

    function test_onlyPolManagerInitializes() public {
        TaxHook fresh = _deployHook(0x5555);
        PoolKey memory freshKey = _key(IHooks(address(fresh)));
        vm.expectRevert();
        router.initialize(freshKey, _sqrtPrice());
        pol.initialize(freshKey, _sqrtPrice());
        assertTrue(fresh.poolInitialized());
    }

    function test_wrongPairReverts() public {
        TaxHook fresh = _deployHook(0x5555);
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        (address c0, address c1) =
            address(other) < address(token) ? (address(other), address(token)) : (address(token), address(other));
        PoolKey memory wrong = PoolKey(Currency.wrap(c0), Currency.wrap(c1), 3000, SPACING, IHooks(address(fresh)));
        vm.expectRevert();
        pol.initialize(wrong, _sqrtPrice());
    }

    function test_constructorRejectsBadInputs() public {
        TaxHook.TaxSchedule memory ok = TaxHook.TaxSchedule(START_BUY, START_SELL, FLOOR_BUY, FLOOR_SELL, DURATION, 0);
        TaxHook.TaxSchedule memory floorAboveCap = TaxHook.TaxSchedule(START_BUY, START_SELL, 501, FLOOR_SELL, DURATION, 0);
        TaxHook.TaxSchedule memory noDuration = TaxHook.TaxSchedule(START_BUY, START_SELL, FLOOR_BUY, FLOOR_SELL, 0, 0);

        vm.expectRevert(TaxHook.InvalidTaxSchedule.selector);
        new TaxHook(manager, address(token), address(usdc), registry, admin, floorAboveCap);
        vm.expectRevert(TaxHook.InvalidTaxSchedule.selector);
        new TaxHook(manager, address(token), address(usdc), registry, admin, noDuration);
        vm.expectRevert(TaxHook.InvalidPair.selector);
        new TaxHook(manager, address(token), address(0), registry, admin, ok);
        vm.expectRevert(TaxHook.InvalidPair.selector);
        new TaxHook(manager, address(token), address(token), registry, admin, ok);
    }

    function test_callbacksOnlyFromPoolManager() public {
        vm.expectRevert(TaxHook.NotPoolManager.selector);
        hook.beforeSwap(address(this), key, _params(true, -1), "");
        vm.expectRevert(TaxHook.NotPoolManager.selector);
        hook.afterSwap(address(this), key, _params(true, -1), BalanceDelta.wrap(0), "");
    }

    // ---- the four swap shapes, at the floor rates ----

    function test_exactInputBuy_taxesTheUsdcPaid() public {
        _pastLaunch();
        uint256 scrBefore = token.balanceOf(trader);
        _swap(true, -int256(1_000 * USDC));

        assertEq(usdc.balanceOf(address(hook)), 20 * USDC, "2% of the USDC paid");
        assertEq(usdc.balanceOf(trader), 9_000 * USDC, "trader pays exactly the stated amount");
        assertGt(token.balanceOf(trader), scrBefore);
    }

    function test_exactOutputBuy_grossesUpTheUsdcPaid() public {
        _pastLaunch();
        _swap(true, int256(5_000 * SCR));

        uint256 paid = 10_000 * USDC - usdc.balanceOf(trader);
        uint256 fee = usdc.balanceOf(address(hook));
        assertEq(token.balanceOf(trader), 105_000 * SCR, "trader receives exactly the stated amount");
        assertEq(fee, (paid - fee) * FLOOR_BUY / (10_000 - FLOOR_BUY), "fee is 2% of everything paid");
        assertGt(fee, 0);
    }

    function test_exactInputSell_taxesTheUsdcPaidOut() public {
        _pastLaunch();
        _swap(false, -int256(5_000 * SCR));

        uint256 received = usdc.balanceOf(trader) - 10_000 * USDC;
        uint256 fee = usdc.balanceOf(address(hook));
        assertEq(token.balanceOf(trader), 95_000 * SCR, "trader sells exactly the stated amount");
        assertEq(fee, (received + fee) * FLOOR_SELL / 10_000, "3% of the pool's payout");
        assertGt(fee, 0);
    }

    function test_exactOutputSell_grossesUpTheUsdcPaidOut() public {
        _pastLaunch();
        _swap(false, int256(500 * USDC));

        assertEq(usdc.balanceOf(trader), 10_500 * USDC, "trader receives exactly the stated amount");
        assertEq(usdc.balanceOf(address(hook)), 500 * USDC * FLOOR_SELL / (10_000 - FLOOR_SELL));
    }

    function testFuzz_exactInputBuy_feeMatchesRate(uint256 amount, uint256 elapsed) public {
        amount = bound(amount, USDC, 5_000 * USDC);
        elapsed = bound(elapsed, 0, 2 * DURATION);
        vm.warp(block.timestamp + elapsed);

        uint256 rate = hook.currentTaxBps(true);
        _swap(true, -int256(amount));

        assertEq(usdc.balanceOf(address(hook)), amount * rate / 10_000);
        assertEq(usdc.balanceOf(trader), 10_000 * USDC - amount);
    }

    function test_partialFillOnUsdcSpecifiedSwapReverts() public {
        _pastLaunch();
        (uint160 sqrtPrice,,,) = IPoolManager(address(manager)).getSlot0(key.toId());
        IPoolManager.SwapParams memory params = _params(true, -int256(5_000 * USDC));
        // A limit 0.1% from the current price stops the swap well short of 5,000 USDC.
        params.sqrtPriceLimitX96 = params.zeroForOne ? sqrtPrice - sqrtPrice / 1000 : sqrtPrice + sqrtPrice / 1000;

        vm.expectRevert(_hookRevert(IHooks.afterSwap.selector, TaxHook.PartialFillUnsupported.selector));
        vm.prank(trader);
        router.swap(key, params);
    }

    // ---- schedule and administration ----

    function test_ratesDecayFromStartToFloor() public {
        assertEq(hook.currentTaxBps(true), START_BUY);
        assertEq(hook.currentTaxBps(false), START_SELL);
        assertTrue(hook.launchScheduleActive());

        vm.warp(block.timestamp + HALF_LIFE);
        assertApproxEqAbs(hook.currentTaxBps(true), FLOOR_BUY + (START_BUY - FLOOR_BUY) / 2, 1);
        assertApproxEqAbs(hook.currentTaxBps(false), FLOOR_SELL + (START_SELL - FLOOR_SELL) / 2, 1);

        vm.warp(block.timestamp + DURATION - HALF_LIFE);
        assertEq(hook.currentTaxBps(true), FLOOR_BUY);
        assertEq(hook.currentTaxBps(false), FLOOR_SELL);
        assertFalse(hook.launchScheduleActive());
    }

    function test_launchRateAppliesToSwaps() public {
        _swap(true, -int256(1_000 * USDC));
        assertEq(usdc.balanceOf(address(hook)), 200 * USDC, "20% at the open");
    }

    function test_setTaxesOverridesAndRetiresTheSchedule() public {
        vm.prank(admin);
        hook.setTaxes(100, 150);

        assertFalse(hook.launchScheduleActive());
        assertEq(hook.currentTaxBps(true), 100);
        assertEq(hook.currentTaxBps(false), 150);
        _swap(true, -int256(1_000 * USDC));
        assertEq(usdc.balanceOf(address(hook)), 10 * USDC);
    }

    function test_setTaxesIsOwnerOnlyAndCapped() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        vm.prank(trader);
        hook.setTaxes(100, 100);

        vm.startPrank(admin);
        vm.expectRevert(TaxHook.TaxAboveCap.selector);
        hook.setTaxes(501, 100);
        vm.expectRevert(TaxHook.TaxAboveCap.selector);
        hook.setTaxes(100, 501);
        vm.stopPrank();
    }

    function test_forwardTaxesSendsEverythingToTheReserve() public {
        _pastLaunch();
        _swap(true, -int256(1_000 * USDC));
        _swap(false, int256(500 * USDC));
        uint256 held = usdc.balanceOf(address(hook));

        vm.prank(trader); // permissionless
        hook.forwardTaxes();

        assertEq(usdc.balanceOf(reserve), held);
        assertEq(usdc.balanceOf(address(hook)), 0);
    }

    function test_forwardTaxesNeedsAReserve() public {
        registry.set(Keys.FEE_SPLITTER, address(0));
        vm.expectRevert(TaxHook.NoFeeSplitter.selector);
        hook.forwardTaxes();
    }

    // ---- liquidity ----

    function test_thirdPartyLiquidityClosedDuringLaunch() public {
        vm.expectRevert(_hookRevert(IHooks.beforeAddLiquidity.selector, TaxHook.LpDepositsClosedDuringLaunch.selector));
        vm.prank(lp);
        router.modifyLiquidity(key, _fullRange(1e16));

        _pastLaunch();
        vm.prank(lp);
        router.modifyLiquidity(key, _fullRange(1e16));
        assertLt(usdc.balanceOf(lp), 10_000 * USDC);
    }

    function test_thirdPartyWithdrawalIsTaxedOnPrincipal() public {
        _pastLaunch();
        vm.startPrank(lp);
        router.modifyLiquidity(key, _fullRange(1e16));
        uint256 usdcBefore = usdc.balanceOf(lp);
        uint256 scrBefore = token.balanceOf(lp);
        router.modifyLiquidity(key, _fullRange(-1e16));
        vm.stopPrank();

        uint256 usdcOut = usdc.balanceOf(lp) - usdcBefore;
        uint256 scrOut = token.balanceOf(lp) - scrBefore;
        uint256 usdcFee = usdc.balanceOf(address(hook));
        uint256 burned = token.burnedForever();
        assertEq(usdcFee, (usdcOut + usdcFee) * FLOOR_SELL / 10_000, "USDC principal pays the sell rate");
        assertEq(burned, (scrOut + burned) * FLOOR_BUY / 10_000, "SCR principal pays the buy rate, burned");
        assertGt(usdcFee, 0);
        assertGt(burned, 0);
        assertEq(token.balanceOf(address(hook)), 0, "the hook never holds SCR");
    }

    function test_polWithdrawalIsNotTaxed() public {
        _pastLaunch(); // the token caps wallet balances on pool outflows during launch
        vm.prank(treasury);
        pol.modifyLiquidity(key, _fullRange(-1e17));

        assertEq(usdc.balanceOf(address(hook)), 0);
        assertEq(token.burnedForever(), 0);
    }

    // ---- venue gate ----

    function test_scrCannotSettleInAPoolWithoutTheHook() public {
        _pastLaunch();
        PoolKey memory untaxed = _key(IHooks(address(0)));
        router.initialize(untaxed, _sqrtPrice());

        vm.expectRevert();
        vm.prank(lp);
        router.modifyLiquidity(untaxed, _fullRange(1e16));
    }
}

contract TaxHookUsdcFirstTest is TaxHookTest {
    function _usdcAddress() internal pure override returns (address) {
        return address(0x1000);
    }

    function test_usdcIsCurrency0() public view {
        assertTrue(usdcFirst);
    }
}

contract TaxHookScrFirstTest is TaxHookTest {
    function _usdcAddress() internal pure override returns (address) {
        return address(type(uint160).max - 0xff);
    }

    function test_usdcIsCurrency1() public view {
        assertFalse(usdcFirst);
    }
}
