// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {Vault, IBackstopFund} from "../src/Vault.sol";
import {StakedBackstopFund} from "../src/StakedBackstopFund.sol";
import {Reserve} from "../src/Reserve.sol";
import {TaxHook} from "../src/token/TaxHook.sol";
import {SacredTokenDummy} from "../src/token/SacredTokenDummy.sol";
import {SacredMinter} from "../src/token/SacredMinter.sol";
import {LiquidityManager} from "../src/token/LiquidityManager.sol";
import {FeeSplitter} from "../src/token/FeeSplitter.sol";
import {ReserveSale} from "../src/token/ReserveSale.sol";
import {AddressRegistry} from "../src/token/AddressRegistry.sol";
import {Keys} from "../src/token/libraries/Keys.sol";
import {MockERC20} from "../src/mocks/Mocks.sol";
import {V4Router} from "./TaxHook.t.sol";

/// Stands in for the desk: it borrows from the bucket and reports what it holds at
/// face value.
contract DeskStub {
    Vault internal vault;
    IERC20 internal usdc;
    uint256 internal book;

    function bind(Vault vault_, IERC20 usdc_) external {
        vault = vault_;
        usdc = usdc_;
        usdc_.approve(address(vault_), type(uint256).max);
    }

    function bookValue() external view returns (uint256, uint256) {
        return (book, 0);
    }

    function lend(uint256 amount) external {
        vault.lend(amount);
        book += amount;
    }

    function repay(uint256 principal, uint256 markup) external {
        book -= principal;
        vault.repay(principal, markup);
    }

    function writeOff(uint256 principal) external {
        book -= principal;
        vault.writeOff(principal);
    }
}

/// Shared fixture: the whole SCR side wired as it would be deployed. A USDC bucket
/// holds 1,000,000 USDC, so the reserve's target is 100,000. The pool opens at
/// 0.10 USDC per SCR with the protocol's liquidity, and the launch fee decays from
/// 20%/30% to 1%/3% over an hour.
abstract contract SacredSystemTest is Test {
    uint256 internal constant USDC = 1e6;
    uint256 internal constant SCR = 1e18;
    uint256 internal constant FLOOR_BUY = 100;
    uint256 internal constant FLOOR_SELL = 300;
    uint256 internal constant LAUNCH = 1 hours;
    int24 internal constant SPACING = 60;

    uint160 internal constant HOOK_FLAGS = Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
        | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG
        | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        | Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;

    address internal admin = makeAddr("admin"); // the time-lock
    address internal treasury = makeAddr("treasury");
    address internal distributor = makeAddr("distributor"); // receives the genesis supply
    address internal keeper = makeAddr("keeper");
    address internal manager = makeAddr("manager");
    address internal alice = makeAddr("alice"); // depositor
    address internal trader = makeAddr("trader");
    address internal buyer = makeAddr("buyer");
    address internal staker = makeAddr("staker");
    address internal staker2 = makeAddr("staker2");

    PoolManager internal poolManager;
    AddressRegistry internal registry;
    SacredMinter internal minter;
    SacredTokenDummy internal token;
    MockERC20 internal usdc;
    TaxHook internal hook;
    LiquidityManager internal liq;
    Reserve internal reserve;
    StakedBackstopFund internal fund;
    FeeSplitter internal splitter;
    ReserveSale internal sale;
    Vault internal vault;
    DeskStub internal desk;
    V4Router internal router;
    PoolKey internal key;
    bool internal usdcFirst;

    /// Where the USDC mock lives, which decides the pool's currency order.
    function _usdcAddress() internal pure virtual returns (address);

    function setUp() public virtual {
        vm.warp(1_760_000_000);
        poolManager = new PoolManager(address(this));
        registry = new AddressRegistry(admin);
        minter = new SacredMinter(admin);
        token = new SacredTokenDummy(address(minter), registry, address(poolManager));
        deployCodeTo("Mocks.sol:MockERC20", abi.encode("USD Coin", "USDC", uint8(6)), _usdcAddress());
        usdc = MockERC20(_usdcAddress());
        usdcFirst = address(usdc) < address(token);

        address hookAddress = address((uint160(0x4444) << 144) | HOOK_FLAGS);
        TaxHook.TaxSchedule memory schedule = TaxHook.TaxSchedule(2_000, 3_000, FLOOR_BUY, FLOOR_SELL, LAUNCH, 10 minutes);
        deployCodeTo("TaxHook.sol:TaxHook", abi.encode(poolManager, token, usdc, registry, admin, schedule), hookAddress);
        hook = TaxHook(hookAddress);

        liq = new LiquidityManager(poolManager, admin);
        reserve = new Reserve(IERC20(address(usdc)), admin);
        fund = new StakedBackstopFund(
            IERC20(address(usdc)), IERC20(address(token)), treasury, address(reserve), poolManager, hook, admin
        );
        splitter = new FeeSplitter(IERC20(address(usdc)), treasury, reserve, address(fund));
        sale = new ReserveSale(IERC20(address(usdc)), token, minter, reserve, hook, fund, admin);
        vault = new Vault(
            IERC20(address(usdc)), manager, admin, 10_000_000_000 * USDC, block.timestamp + 7 days, "Sacred USDC Term"
        );
        router = new V4Router(poolManager);
        desk = new DeskStub();
        desk.bind(vault, IERC20(address(usdc)));

        vm.startPrank(admin);
        registry.set(Keys.TAX_HOOK, address(hook));
        registry.set(Keys.POL_MANAGER, address(liq));
        registry.set(Keys.FEE_SPLITTER, address(splitter));
        registry.set(Keys.BACKSTOP_FUND, address(fund));
        minter.bind(token);
        minter.genesis(distributor);
        minter.setSale(address(sale));
        vault.setDesk(address(desk));
        vault.setFund(IBackstopFund(address(fund)));
        vault.setDepositor(alice, true);
        vault.setDepositor(address(reserve), true);
        fund.setVault(address(vault), true);
        reserve.setVault(vault, true);
        reserve.setOperator(keeper);
        vm.stopPrank();

        _approve(manager, address(vault));
        _approve(alice, address(vault));
        _approve(trader, address(router));
        _approve(buyer, address(router));
        _approve(buyer, address(sale));
        usdc.mint(trader, 10_000 * USDC);
        usdc.mint(buyer, 1_000_000 * USDC);
        vm.prank(distributor);
        token.transfer(trader, 100_000 * SCR);

        _seedBucket(100_000 * USDC, 900_000 * USDC);
        _openPool();
    }

    // ── helpers ──

    function _approve(address who, address spender) internal {
        vm.startPrank(who);
        usdc.approve(spender, type(uint256).max);
        token.approve(spender, type(uint256).max);
        vm.stopPrank();
    }

    /// The manager and Alice fund the bucket and the first cut-off prices it.
    function _seedBucket(uint256 fromManager, uint256 fromAlice) internal {
        usdc.mint(manager, fromManager);
        usdc.mint(alice, fromAlice);
        vm.prank(manager);
        vault.requestDeposit(fromManager);
        vm.prank(alice);
        vault.requestDeposit(fromAlice);
        _cutoff();
        vault.claimDeposit(manager);
        vault.claimDeposit(alice);
    }

    function _cutoff() internal {
        if (block.timestamp < vault.nextCutoff()) vm.warp(vault.nextCutoff());
        vault.cutoff();
    }

    /// The desk takes cash out of the bucket and Alice queues a withdrawal, leaving
    /// the bucket short by `lend + withdraw - idle`.
    function _makeShort(uint256 lend, uint256 withdrawShares) internal {
        desk.lend(lend);
        vm.prank(alice);
        vault.requestWithdraw(withdrawShares);
    }

    function _key() internal view returns (PoolKey memory) {
        (address c0, address c1) = usdcFirst ? (address(usdc), address(token)) : (address(token), address(usdc));
        return PoolKey(Currency.wrap(c0), Currency.wrap(c1), 3000, SPACING, IHooks(address(hook)));
    }

    /// 0.10 USDC per SCR is 1e13 raw SCR per raw USDC.
    function _sqrtPrice() internal view returns (uint160) {
        uint256 ratioX192 = usdcFirst ? uint256(1e13) << 192 : (uint256(1) << 192) / 1e13;
        return uint160(FixedPointMathLib.sqrt(ratioX192));
    }

    function _fullRange() internal pure returns (int24, int24) {
        return (TickMath.minUsableTick(SPACING), TickMath.maxUsableTick(SPACING));
    }

    /// A range that sits wholly on the side where SCR is dearer than today, so it
    /// holds SCR only.
    function _scrOnlyRange() internal view returns (int24 lower, int24 upper) {
        int24 tick = TickMath.getTickAtSqrtPrice(_sqrtPrice()) / SPACING * SPACING;
        return usdcFirst ? (tick - 6_000, tick - 600) : (tick + 600, tick + 6_000);
    }

    /// The protocol opens the pool with about 95,000 USDC and 950,000 SCR.
    function _openPool() internal {
        key = _key();
        usdc.mint(address(liq), 100_000 * USDC);
        vm.prank(distributor);
        token.transfer(address(liq), 40_000_000 * SCR);
        (int24 lower, int24 upper) = _fullRange();
        vm.startPrank(admin);
        liq.openPool(key, _sqrtPrice());
        liq.addLiquidity(lower, upper, 3e17, type(uint256).max, type(uint256).max);
        vm.stopPrank();
    }

    function _swap(address who, bool isBuy, int256 amountSpecified) internal {
        bool zeroForOne = isBuy == usdcFirst;
        vm.prank(who);
        router.swap(
            key,
            IPoolManager.SwapParams(
                zeroForOne, amountSpecified, zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            )
        );
    }

    function _pastLaunch() internal {
        vm.warp(block.timestamp + LAUNCH);
    }

    /// Give `who` SCR from the genesis supply and stake it.
    function _stake(address who, uint256 amount) internal {
        vm.prank(distributor);
        token.transfer(who, amount);
        vm.startPrank(who);
        token.approve(address(fund), amount);
        fund.stake(amount);
        vm.stopPrank();
    }

    /// A profit share arrives at the fund, as the desk would send it.
    function _profitShare(uint256 amount) internal {
        usdc.mint(address(this), amount);
        usdc.approve(address(fund), amount);
        fund.receiveShare(amount);
    }

    function _valuePerToken() internal view returns (uint256) {
        return reserve.totalAssets() * 1e30 / token.totalSupply();
    }

    // ───────────────────────── SacredMinter ─────────────────────────

    function test_minter_genesisMintsEverythingButTheSaleAllocation() public view {
        assertEq(token.totalSupply(), 900_000_000 * SCR);
        assertEq(minter.GENESIS_SUPPLY() + minter.SALE_ALLOCATION(), token.HARD_CAP());
        assertTrue(minter.genesisDone());
    }

    function test_minter_genesisOnlyOnce() public {
        vm.prank(admin);
        vm.expectRevert(SacredMinter.AlreadySet.selector);
        minter.genesis(distributor);
    }

    function test_minter_bindAndGenesisAreOwnerOnlyAndOrdered() public {
        SacredMinter fresh = new SacredMinter(admin);
        SacredTokenDummy freshToken = new SacredTokenDummy(address(fresh), registry, address(poolManager));

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        vm.prank(trader);
        fresh.bind(freshToken);

        vm.startPrank(admin);
        vm.expectRevert(SacredMinter.NotBound.selector);
        fresh.genesis(distributor);
        vm.expectRevert(SacredMinter.ZeroAddress.selector);
        fresh.bind(SacredTokenDummy(address(0)));
        fresh.bind(freshToken);
        vm.expectRevert(SacredMinter.AlreadySet.selector);
        fresh.bind(freshToken);
        vm.expectRevert(SacredMinter.ZeroAddress.selector);
        fresh.genesis(address(0));
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        vm.prank(trader);
        fresh.genesis(trader);
    }

    function test_minter_onlyTheSaleMints() public {
        vm.expectRevert(SacredMinter.NotSale.selector);
        vm.prank(admin);
        minter.mintForSale(admin, 1);
    }

    function test_minter_saleAllocationIsTheCeiling() public {
        vm.prank(admin);
        minter.setSale(address(this));

        minter.mintForSale(buyer, 100_000_000 * SCR);
        assertEq(token.totalSupply(), token.HARD_CAP());
        vm.expectRevert(SacredMinter.AllocationExceeded.selector);
        minter.mintForSale(buyer, 1);
    }

    function test_minter_ownerHoldsTheTokenSwitches() public {
        vm.expectRevert(SacredTokenDummy.NotBankOwner.selector);
        vm.prank(trader);
        token.setPoolManagerGate(false);

        vm.prank(admin);
        token.setPoolManagerGate(false);
        assertFalse(token.poolManagerGateEnabled());
    }

    // ───────────────────────── LiquidityManager ─────────────────────────

    function test_liquidity_poolOpenedByTheManager() public view {
        assertTrue(liq.poolOpened());
        assertTrue(hook.poolInitialized());
        assertApproxEqRel(usdc.balanceOf(address(poolManager)), 94_868 * USDC, 0.001e18);
        assertApproxEqRel(token.balanceOf(address(poolManager)), 948_683 * SCR, 0.001e18);
    }

    function test_liquidity_ownerOnly() public {
        (int24 lower, int24 upper) = _fullRange();
        vm.startPrank(trader);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        liq.openPool(key, _sqrtPrice());
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        liq.addLiquidity(lower, upper, 1e16, type(uint256).max, type(uint256).max);
        vm.stopPrank();
    }

    function test_liquidity_opensOnlyOnce() public {
        vm.expectRevert(LiquidityManager.AlreadyInitialized.selector);
        vm.prank(admin);
        liq.openPool(key, _sqrtPrice());
    }

    function test_liquidity_needsAnOpenPool() public {
        LiquidityManager fresh = new LiquidityManager(poolManager, admin);
        (int24 lower, int24 upper) = _fullRange();
        vm.expectRevert(LiquidityManager.NotInitialized.selector);
        vm.prank(admin);
        fresh.addLiquidity(lower, upper, 1e16, type(uint256).max, type(uint256).max);
        vm.expectRevert(LiquidityManager.NotInitialized.selector);
        fresh.collectFees(lower, upper);
    }

    function test_liquidity_addsDuringLaunchAndReportsBothSides() public {
        assertTrue(hook.launchScheduleActive());
        (int24 lower, int24 upper) = _fullRange();
        uint256 usdcBefore = usdc.balanceOf(address(liq));
        uint256 scrBefore = token.balanceOf(address(liq));

        vm.prank(admin);
        (uint256 amount0, uint256 amount1) = liq.addLiquidity(lower, upper, 1e16, type(uint256).max, type(uint256).max);

        (uint256 usdcIn, uint256 scrIn) = usdcFirst ? (amount0, amount1) : (amount1, amount0);
        assertEq(usdcBefore - usdc.balanceOf(address(liq)), usdcIn);
        assertEq(scrBefore - token.balanceOf(address(liq)), scrIn);
        assertGt(usdcIn, 0);
        assertGt(scrIn, 0);
    }

    function test_liquidity_scrOnlyRangeCostsNoUsdc() public {
        (int24 lower, int24 upper) = _scrOnlyRange();
        uint256 usdcBefore = usdc.balanceOf(address(liq));
        uint256 scrBefore = token.balanceOf(address(liq));

        vm.prank(admin);
        liq.addLiquidity(lower, upper, 1e18, type(uint256).max, type(uint256).max);

        assertEq(usdc.balanceOf(address(liq)), usdcBefore, "the protocol puts in no dollars");
        assertLt(token.balanceOf(address(liq)), scrBefore);
    }

    function test_liquidity_slippageBound() public {
        (int24 lower, int24 upper) = _fullRange();
        vm.expectRevert(LiquidityManager.SlippageExceeded.selector);
        vm.prank(admin);
        liq.addLiquidity(lower, upper, 1e16, 1, 1);
    }

    function test_liquidity_zeroLiquidityReverts() public {
        (int24 lower, int24 upper) = _fullRange();
        vm.expectRevert(LiquidityManager.ZeroLiquidity.selector);
        vm.prank(admin);
        liq.addLiquidity(lower, upper, 0, type(uint256).max, type(uint256).max);
    }

    function test_liquidity_feesAreCollectedIntoTheManager() public {
        _pastLaunch();
        _swap(trader, true, -int256(2_000 * USDC));
        _swap(trader, false, -int256(10_000 * SCR));
        (int24 lower, int24 upper) = _fullRange();
        uint256 usdcBefore = usdc.balanceOf(address(liq));
        uint256 scrBefore = token.balanceOf(address(liq));

        vm.prank(trader); // permissionless
        (uint256 amount0, uint256 amount1) = liq.collectFees(lower, upper);

        (uint256 usdcFees, uint256 scrFees) = usdcFirst ? (amount0, amount1) : (amount1, amount0);
        assertGt(usdcFees, 0);
        assertGt(scrFees, 0);
        assertEq(usdc.balanceOf(address(liq)) - usdcBefore, usdcFees);
        assertEq(token.balanceOf(address(liq)) - scrBefore, scrFees);
        assertEq(usdc.balanceOf(address(hook)), 2_000 * USDC / 100 + _sellTaxHeld(), "collecting fees pays no tax");
    }

    /// The hook's balance beyond the buy tax of the 2,000 USDC purchase.
    function _sellTaxHeld() internal view returns (uint256) {
        return usdc.balanceOf(address(hook)) - 2_000 * USDC / 100;
    }

    function test_liquidity_callbackOnlyFromPoolManager() public {
        vm.expectRevert(LiquidityManager.NotPoolManager.selector);
        liq.unlockCallback("");
    }

    // ───────────────────────── FeeSplitter ─────────────────────────

    function test_splitter_belowTargetFeedsTheReserve() public {
        usdc.mint(address(splitter), 1_000 * USDC);
        splitter.split();

        assertEq(usdc.balanceOf(treasury), 200 * USDC);
        assertEq(usdc.balanceOf(address(reserve)), 800 * USDC);
        assertEq(fund.available(), 0);
        assertEq(usdc.balanceOf(address(splitter)), 0);
    }

    function test_splitter_atTargetFeedsTheFund() public {
        usdc.mint(address(reserve), 100_000 * USDC); // the target
        usdc.mint(address(splitter), 1_000 * USDC);
        splitter.split();

        assertEq(usdc.balanceOf(treasury), 200 * USDC);
        assertEq(usdc.balanceOf(address(reserve)), 100_000 * USDC);
        assertEq(fund.available(), 800 * USDC, "counts in full as shortfall cover");
    }

    function test_splitter_fillsTheReserveThenTheFund() public {
        usdc.mint(address(reserve), 99_700 * USDC); // 300 short of the target
        usdc.mint(address(splitter), 1_000 * USDC);
        splitter.split();

        assertEq(usdc.balanceOf(treasury), 200 * USDC);
        assertEq(usdc.balanceOf(address(reserve)), 100_000 * USDC);
        assertEq(fund.available(), 500 * USDC);
    }

    function testFuzz_splitter_paysOutEverything(uint256 amount, uint256 inReserve) public {
        amount = bound(amount, 0, 10_000_000 * USDC);
        inReserve = bound(inReserve, 0, 200_000 * USDC);
        usdc.mint(address(reserve), inReserve);
        usdc.mint(address(splitter), amount);
        splitter.split();

        assertEq(usdc.balanceOf(address(splitter)), 0);
        assertEq(usdc.balanceOf(treasury), amount * 2_000 / 10_000);
        assertEq(usdc.balanceOf(treasury) + usdc.balanceOf(address(reserve)) - inReserve + fund.available(), amount);
        assertLe(usdc.balanceOf(address(reserve)), inReserve > 100_000 * USDC ? inReserve : 100_000 * USDC);
    }

    function test_splitter_rejectsZeroAddresses() public {
        vm.expectRevert(FeeSplitter.ZeroAddress.selector);
        new FeeSplitter(IERC20(address(usdc)), address(0), reserve, address(fund));
        vm.expectRevert(FeeSplitter.ZeroAddress.selector);
        new FeeSplitter(IERC20(address(usdc)), treasury, Reserve(address(0)), address(fund));
        vm.expectRevert(FeeSplitter.ZeroAddress.selector);
        new FeeSplitter(IERC20(address(usdc)), treasury, reserve, address(0));
    }

    // ───────────────────────── Reserve ─────────────────────────

    function test_reserve_targetIsAShareOfDeposits() public {
        assertEq(reserve.target(), 100_000 * USDC);
        assertEq(reserve.shortfallToTarget(), 100_000 * USDC);

        usdc.mint(address(reserve), 30_000 * USDC);
        assertEq(reserve.totalAssets(), 30_000 * USDC);
        assertEq(reserve.shortfallToTarget(), 70_000 * USDC);

        usdc.mint(address(reserve), 100_000 * USDC);
        assertEq(reserve.shortfallToTarget(), 0);
    }

    function test_reserve_shortageIsWhatTheQueueLacks() public {
        assertEq(reserve.shortage(vault), 0);
        _makeShort(800_000 * USDC, 500_000 * USDC); // 200,000 idle against 500,000 queued
        assertEq(reserve.shortage(vault), 300_000 * USDC);
    }

    function test_reserve_depositGuards() public {
        usdc.mint(address(reserve), 400_000 * USDC);

        vm.expectRevert(Reserve.NotOperator.selector);
        vm.prank(trader);
        reserve.deposit(vault, 1 * USDC);

        vm.startPrank(keeper);
        vm.expectRevert(Reserve.NotListed.selector);
        reserve.deposit(Vault(address(0xdead)), 1 * USDC);
        vm.expectRevert(Reserve.NotShort.selector);
        reserve.deposit(vault, 1 * USDC);
        vm.stopPrank();

        _makeShort(800_000 * USDC, 500_000 * USDC);
        vm.expectRevert(Reserve.AboveShortage.selector);
        vm.prank(keeper);
        reserve.deposit(vault, 300_000 * USDC + 1);
    }

    function test_reserve_depositCoversTheQueueAndComesBack() public {
        usdc.mint(address(reserve), 400_000 * USDC);
        _makeShort(800_000 * USDC, 500_000 * USDC);

        vm.prank(keeper);
        reserve.deposit(vault, 300_000 * USDC);
        assertEq(reserve.shortage(vault), 0, "a queued deposit counts towards the queue");
        assertEq(reserve.totalAssets(), 400_000 * USDC);
        vm.expectRevert(Reserve.NotShort.selector);
        vm.prank(keeper);
        reserve.deposit(vault, 1);

        _cutoff();
        vault.claimWithdraw(alice);
        assertEq(usdc.balanceOf(alice), 500_000 * USDC, "paid in full");
        reserve.claim(vault);
        assertEq(vault.balanceOf(address(reserve)), 300_000 * USDC);
        assertEq(reserve.deployed(vault), 300_000 * USDC);
        assertEq(reserve.totalAssets(), 400_000 * USDC);

        // The desk repays, the pressure clears and the reserve leaves.
        usdc.mint(address(desk), 300_000 * USDC); // it still holds the 500,000 Alice left behind
        desk.repay(800_000 * USDC, 0);
        vm.prank(keeper);
        reserve.requestWithdraw(vault, 300_000 * USDC);
        assertEq(reserve.totalAssets(), 400_000 * USDC, "queued shares still count");
        _cutoff();
        reserve.claim(vault);

        assertEq(usdc.balanceOf(address(reserve)), 400_000 * USDC);
        assertEq(reserve.deployed(vault), 0);
    }

    function test_reserve_withdrawIsOperatorOnly() public {
        vm.expectRevert(Reserve.NotOperator.selector);
        vm.prank(trader);
        reserve.requestWithdraw(vault, 1);
        vm.expectRevert(Reserve.NotListed.selector);
        vm.prank(keeper);
        reserve.requestWithdraw(Vault(address(0xdead)), 1);
    }

    function test_reserve_sharesTheBucketsLoss() public {
        usdc.mint(address(reserve), 300_000 * USDC);
        _makeShort(800_000 * USDC, 500_000 * USDC);
        vm.prank(keeper);
        reserve.deposit(vault, 300_000 * USDC);
        _cutoff();
        reserve.claim(vault);

        // 400,000 of the 800,000 lent never comes back; 800,000 of shares remain.
        desk.writeOff(400_000 * USDC);
        _cutoff();

        assertEq(reserve.deployed(vault), 150_000 * USDC, "half of its stake, like every depositor");
    }

    function test_reserve_listingRules() public {
        MockERC20 other = new MockERC20("Other", "OTH", 6);
        Vault wrong = new Vault(IERC20(address(other)), manager, admin, 1, block.timestamp + 1, "Wrong");
        Vault second = new Vault(IERC20(address(usdc)), manager, admin, 1, block.timestamp + 1, "Second");

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        vm.prank(trader);
        reserve.setVault(second, true);

        vm.startPrank(admin);
        vm.expectRevert(Reserve.WrongAsset.selector);
        reserve.setVault(wrong, true);
        reserve.setVault(second, true);
        assertEq(reserve.vaultCount(), 2);
        reserve.setVault(vault, false);
        assertEq(reserve.vaultCount(), 1);
        assertFalse(reserve.isListed(address(vault)));
        assertEq(address(reserve.vaults(0)), address(second));
        vm.stopPrank();
    }

    function test_reserve_cannotUnlistABucketItIsIn() public {
        usdc.mint(address(reserve), 300_000 * USDC);
        _makeShort(800_000 * USDC, 500_000 * USDC);
        vm.prank(keeper);
        reserve.deposit(vault, 300_000 * USDC);

        vm.expectRevert(Reserve.PositionOpen.selector);
        vm.prank(admin);
        reserve.setVault(vault, false);
    }

    function test_reserve_targetBounds() public {
        vm.startPrank(admin);
        vm.expectRevert(Reserve.OutOfBounds.selector);
        reserve.setTargetBps(5_001);
        reserve.setTargetBps(2_000);
        vm.stopPrank();
        assertEq(reserve.target(), 200_000 * USDC);
    }

    // ───────────────────────── ReserveSale ─────────────────────────

    function test_sale_marketPriceReadsThePool() public view {
        assertApproxEqRel(sale.marketPrice(), USDC / 10, 0.0002e18); // 0.10 USDC, to within a tick
    }

    function test_sale_priceIsTheDiscountedMarketWhenTheReserveIsThin() public {
        usdc.mint(address(reserve), 50_000 * USDC);
        assertLt(sale.reserveValuePerToken(), 100);
        assertEq(sale.price(), sale.marketPrice() * 9_600 / 10_000);
    }

    function test_sale_needsPriceHistory() public {
        vm.expectRevert(ReserveSale.TwapNotReady.selector);
        vm.prank(buyer);
        sale.buy(1_000 * SCR, type(uint256).max);
    }

    function test_sale_buyPaysTheReserveAndMintsToTheBuyer() public {
        _pastLaunch();
        uint256 unitPrice = sale.price();
        uint256 supplyBefore = token.totalSupply();

        vm.prank(buyer);
        uint256 cost = sale.buy(100_000 * SCR, type(uint256).max);

        assertEq(cost, 100_000 * unitPrice);
        assertApproxEqRel(cost, 9_600 * USDC, 0.0002e18);
        assertEq(usdc.balanceOf(address(reserve)), cost, "every dollar goes to the reserve");
        assertEq(usdc.balanceOf(buyer), 1_000_000 * USDC - cost);
        assertEq(fund.stakeOf(buyer), 100_000 * SCR, "delivered staked");
        assertEq(token.balanceOf(buyer), 0);
        assertEq(token.totalSupply(), supplyBefore + 100_000 * SCR);
        assertEq(minter.mintedForSale(), 100_000 * SCR);
        assertEq(usdc.balanceOf(address(sale)), 0);
    }

    function test_sale_closedOnceTheReserveIsAtTarget() public {
        _pastLaunch();
        usdc.mint(address(reserve), 100_000 * USDC);
        assertFalse(sale.isOpen());

        vm.expectRevert(ReserveSale.Closed.selector);
        vm.prank(buyer);
        sale.buy(1_000 * SCR, type(uint256).max);
    }

    function test_sale_buyerBounds() public {
        _pastLaunch();
        vm.startPrank(buyer);
        vm.expectRevert(ReserveSale.ZeroAmount.selector);
        sale.buy(0, type(uint256).max);
        vm.expectRevert(ReserveSale.CostAboveMax.selector);
        sale.buy(1_000 * SCR, 90 * USDC);
        sale.buy(1_000 * SCR, 100 * USDC);
        vm.stopPrank();
    }

    function test_sale_weeklyCapResets() public {
        _pastLaunch();
        vm.startPrank(buyer);
        sale.buy(500_000 * SCR, type(uint256).max);
        assertEq(sale.remainingThisPeriod(), 0);
        vm.expectRevert(ReserveSale.PeriodCapExceeded.selector);
        sale.buy(1, type(uint256).max);

        vm.warp(block.timestamp + 7 days);
        assertEq(sale.remainingThisPeriod(), 500_000 * SCR);
        sale.buy(1_000 * SCR, type(uint256).max);
        vm.stopPrank();
    }

    function test_sale_priceIsTheReserveValueWhenThatIsHigher() public {
        // A bucket of 1 billion USDC puts the target at 100 million, and a reserve of
        // 95 million is worth about 0.1056 USDC per SCR, above the pool's 0.096.
        _seedBucket(50_000_000 * USDC, 949_000_000 * USDC);
        usdc.mint(address(reserve), 95_000_000 * USDC);
        _pastLaunch();

        assertTrue(sale.isOpen());
        assertGt(sale.reserveValuePerToken(), sale.marketPrice() * 9_600 / 10_000);
        assertEq(sale.price(), sale.reserveValuePerToken());
        assertEq(sale.price(), 105_556);

        uint256 before = _valuePerToken();
        vm.prank(buyer);
        sale.buy(100_000 * SCR, type(uint256).max);
        assertGe(_valuePerToken(), before);
    }

    function testFuzz_sale_neverLowersTheReserveValuePerToken(uint256 inReserve, uint256 amount) public {
        inReserve = bound(inReserve, 0, 99_999 * USDC);
        amount = bound(amount, 1, 500_000 * SCR);
        usdc.mint(address(reserve), inReserve);
        _pastLaunch();
        uint256 before = _valuePerToken();
        uint256 assetsBefore = reserve.totalAssets();
        uint256 floorBefore = sale.reserveValuePerToken();

        vm.prank(buyer);
        uint256 cost = sale.buy(amount, type(uint256).max);

        assertGe(_valuePerToken(), before);
        assertEq(reserve.totalAssets(), assetsBefore + cost);
        assertGe(cost * SCR, amount * floorBefore, "never sold below the reserve value");
    }

    function test_sale_marketPriceFollowsTrading() public {
        _pastLaunch();
        uint256 before = sale.marketPrice();
        _swap(buyer, true, -int256(20_000 * USDC)); // pushes SCR up
        vm.warp(block.timestamp + 2 hours);
        _swap(buyer, true, -int256(1 * USDC));
        vm.warp(block.timestamp + 1 hours);

        assertGt(sale.marketPrice(), before * 12 / 10);
    }

    function test_sale_guardianCanStopButNotResume() public {
        _pastLaunch();
        address guardian = makeAddr("guardian");
        vm.prank(admin);
        sale.setGuardian(guardian);

        vm.expectRevert(ReserveSale.NotAllowed.selector);
        vm.prank(trader);
        sale.pause(true);

        vm.prank(guardian);
        sale.pause(true);
        vm.expectRevert(ReserveSale.Paused.selector);
        vm.prank(buyer);
        sale.buy(1_000 * SCR, type(uint256).max);

        vm.expectRevert(ReserveSale.NotAllowed.selector);
        vm.prank(guardian);
        sale.pause(false);
        vm.prank(admin);
        sale.pause(false);
        vm.prank(buyer);
        sale.buy(1_000 * SCR, type(uint256).max);
    }

    function test_sale_discountBounds() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        vm.prank(trader);
        sale.setDiscountBps(300);

        vm.startPrank(admin);
        vm.expectRevert(ReserveSale.OutOfBounds.selector);
        sale.setDiscountBps(1_001);
        sale.setDiscountBps(300);
        vm.stopPrank();
        assertEq(sale.price(), sale.marketPrice() * 9_700 / 10_000);
    }

    // ───────────────────────── StakedBackstopFund: staking ─────────────────────────

    function test_fund_stakeAndStakeFor() public {
        _stake(staker, 1_000 * SCR);
        assertEq(fund.stakeOf(staker), 1_000 * SCR);
        assertEq(fund.totalStaked(), 1_000 * SCR);
        assertEq(token.balanceOf(address(fund)), 1_000 * SCR);

        vm.startPrank(distributor);
        token.approve(address(fund), 500 * SCR);
        fund.stakeFor(staker2, 500 * SCR);
        vm.stopPrank();
        assertEq(fund.stakeOf(staker2), 500 * SCR);
        assertEq(fund.totalStaked(), 1_500 * SCR);
    }

    function test_fund_stakeGuards() public {
        vm.startPrank(distributor);
        token.approve(address(fund), type(uint256).max);
        vm.expectRevert(StakedBackstopFund.ZeroAmount.selector);
        fund.stake(0);
        vm.expectRevert(StakedBackstopFund.ZeroAddress.selector);
        fund.stakeFor(address(0), 1 * SCR);
        vm.stopPrank();
    }

    function test_fund_directTransfersDoNotCountAsStake() public {
        _stake(staker, 1_000 * SCR);
        vm.prank(distributor);
        token.transfer(address(fund), 5_000 * SCR);
        assertEq(fund.stakeOf(staker), 1_000 * SCR);
        assertEq(fund.totalStaked(), 1_000 * SCR);
    }

    function test_fund_leavingTakesACooldownThenAWindow() public {
        _stake(staker, 1_000 * SCR);
        vm.startPrank(staker);
        vm.expectRevert(StakedBackstopFund.NoRequest.selector);
        fund.unstake();
        vm.expectRevert(StakedBackstopFund.ZeroAmount.selector);
        fund.requestUnstake(1_001 * SCR);

        fund.requestUnstake(400 * SCR);
        vm.expectRevert(StakedBackstopFund.CoolingDown.selector);
        fund.unstake();
        vm.warp(block.timestamp + 14 days - 1);
        vm.expectRevert(StakedBackstopFund.CoolingDown.selector);
        fund.unstake();

        vm.warp(block.timestamp + 1);
        assertEq(fund.unstake(), 400 * SCR);
        vm.stopPrank();
        assertEq(token.balanceOf(staker), 400 * SCR);
        assertEq(fund.stakeOf(staker), 600 * SCR);
        assertEq(fund.totalStaked(), 600 * SCR);
    }

    function test_fund_aMissedWindowMeansANewCooldown() public {
        _stake(staker, 1_000 * SCR);
        vm.startPrank(staker);
        fund.requestUnstake(1_000 * SCR);
        vm.warp(block.timestamp + 14 days + 7 days + 1);
        vm.expectRevert(StakedBackstopFund.WindowClosed.selector);
        fund.unstake();

        fund.requestUnstake(1_000 * SCR);
        vm.warp(block.timestamp + 14 days + 7 days);
        fund.unstake();
        vm.stopPrank();
        assertEq(token.balanceOf(staker), 1_000 * SCR);
        assertEq(fund.totalShares(), 0);
    }

    // ───────────────────────── StakedBackstopFund: profit share ─────────────────────────

    function test_fund_profitShareIsSplitThreeWays() public {
        _stake(staker, 1_000 * SCR);
        _profitShare(1_000 * USDC);

        assertEq(fund.treasuryAccrued(), 200 * USDC);
        assertEq(usdc.balanceOf(address(reserve)), 150 * USDC);
        assertEq(fund.available(), 650 * USDC, "unstreamed USDC still covers shortfalls");
        assertEq(fund.earned(staker), 0);

        fund.claimTreasury();
        assertEq(usdc.balanceOf(treasury), 200 * USDC);
        assertEq(fund.treasuryAccrued(), 0);
    }

    function test_fund_stakersAreStreamedOver90Days() public {
        _stake(staker, 1_000 * SCR);
        _profitShare(1_000 * USDC);

        vm.warp(block.timestamp + 45 days);
        assertApproxEqAbs(fund.earned(staker), 325 * USDC, 1);
        assertApproxEqAbs(fund.available(), 325 * USDC, 1);

        vm.warp(block.timestamp + 45 days);
        assertApproxEqAbs(fund.earned(staker), 650 * USDC, 1);
        vm.warp(block.timestamp + 30 days);
        assertApproxEqAbs(fund.earned(staker), 650 * USDC, 1, "nothing after the period ends");

        vm.prank(staker);
        uint256 claimed = fund.claim();
        assertApproxEqAbs(claimed, 650 * USDC, 1);
        assertEq(usdc.balanceOf(staker), claimed);
        assertEq(fund.earned(staker), 0);
    }

    function test_fund_stakersShareInProportion() public {
        _stake(staker, 3_000 * SCR);
        _stake(staker2, 1_000 * SCR);
        _profitShare(1_000 * USDC);
        vm.warp(block.timestamp + 90 days);

        assertApproxEqAbs(fund.earned(staker), 487_500_000, 1);
        assertApproxEqAbs(fund.earned(staker2), 162_500_000, 1);
    }

    function test_fund_aLateStakerEarnsOnlyFromArrival() public {
        _stake(staker, 1_000 * SCR);
        _profitShare(1_000 * USDC);
        vm.warp(block.timestamp + 45 days);
        _stake(staker2, 1_000 * SCR);
        vm.warp(block.timestamp + 45 days);

        assertApproxEqAbs(fund.earned(staker), 325 * USDC + 162_500_000, 2);
        assertApproxEqAbs(fund.earned(staker2), 162_500_000, 2);
    }

    function test_fund_aNewShareRestartsTheStream() public {
        _stake(staker, 1_000 * SCR);
        _profitShare(1_000 * USDC);
        vm.warp(block.timestamp + 45 days);
        _profitShare(1_000 * USDC); // 325 left plus 650 new, over a fresh 90 days

        vm.warp(block.timestamp + 45 days);
        assertApproxEqAbs(fund.earned(staker), 325 * USDC + 487_500_000, 2);
        vm.warp(block.timestamp + 45 days);
        assertApproxEqAbs(fund.earned(staker), 1_300 * USDC, 2);
    }

    function test_fund_streamWithNoStakersStaysAsCover() public {
        _profitShare(1_000 * USDC);
        vm.warp(block.timestamp + 90 days);
        assertEq(fund.available(), 650 * USDC);

        _stake(staker, 1_000 * SCR);
        assertEq(fund.earned(staker), 0);
    }

    // ───────────────────────── StakedBackstopFund: shortfalls ─────────────────────────

    function test_fund_onlyAVaultIsCovered() public {
        vm.expectRevert(StakedBackstopFund.NotVault.selector);
        vm.prank(trader);
        fund.cover(1 * USDC);
    }

    function test_fund_coverPaysWhatItHas() public {
        usdc.mint(address(fund), 100 * USDC);
        vm.prank(address(vault));
        assertEq(fund.cover(500 * USDC), 100 * USDC);
        assertEq(usdc.balanceOf(address(vault)), 1_000_000 * USDC + 100 * USDC);
    }

    function test_fund_coverSpendsDirectCoverThenTheStream() public {
        vm.prank(admin);
        fund.setSaleLimits(0, 1_000); // USDC only in this test
        usdc.mint(address(fund), 100 * USDC);
        _stake(staker, 1_000 * SCR);
        _profitShare(1_000 * USDC);
        vm.warp(block.timestamp + 45 days); // 325 streamed, 325 still to come
        assertApproxEqAbs(fund.available(), 425 * USDC, 1);

        vm.prank(address(vault));
        assertEq(fund.cover(300 * USDC), 300 * USDC); // 100 direct, 200 from the stream

        assertApproxEqAbs(fund.earned(staker), 325 * USDC, 1, "what has streamed is the stakers'");
        assertApproxEqAbs(fund.available(), 125 * USDC, 1);
        vm.warp(block.timestamp + 45 days);
        assertApproxEqAbs(fund.earned(staker), 450 * USDC, 2);

        vm.prank(address(vault));
        assertEq(fund.cover(1_000 * USDC), 0, "streamed USDC is never taken back");
        vm.prank(staker);
        assertApproxEqAbs(fund.claim(), 450 * USDC, 2);
    }

    function testFuzz_fund_alwaysPaysWhatItOwes(uint256 share, uint256 wait, uint256 shortfall) public {
        share = bound(share, 0, 10_000_000 * USDC);
        wait = bound(wait, 0, 120 days);
        shortfall = bound(shortfall, 0, 20_000_000 * USDC);
        vm.prank(admin);
        fund.setSaleLimits(0, 1_000);
        _stake(staker, 3_000 * SCR);
        _stake(staker2, 1_000 * SCR);
        _profitShare(share);

        vm.warp(block.timestamp + wait);
        uint256 owed = fund.earned(staker) + fund.earned(staker2);
        vm.prank(address(vault));
        uint256 paid = fund.cover(shortfall);
        assertEq(fund.earned(staker) + fund.earned(staker2), owed, "cover never touches streamed USDC");

        vm.warp(block.timestamp + 90 days);
        vm.prank(staker);
        uint256 a = fund.claim();
        vm.prank(staker2);
        uint256 b = fund.claim();
        fund.claimTreasury();
        assertLe(a + b + paid + usdc.balanceOf(treasury), share - share * 1_500 / 10_000);
        assertGe(a + b, owed);
    }

    function test_fund_shortfallSaleCoversTheRestAndPaysNoPoolFee() public {
        _stake(staker, 600_000 * SCR);
        _stake(staker2, 200_000 * SCR);
        assertTrue(hook.launchScheduleActive()); // a 30% sell fee would apply to anyone else

        vm.prank(address(vault));
        uint256 paid = fund.cover(1_000 * USDC);

        assertEq(paid, 1_000 * USDC, "covered in full");
        assertEq(usdc.balanceOf(address(hook)), 0, "the fund's sale is exempt");
        uint256 sold = 800_000 * SCR - fund.totalStaked();
        assertGt(sold, 10_000 * SCR);
        assertLt(sold, 10_300 * SCR); // 0.10 USDC each, plus the 0.3% liquidity fee and price impact
        assertEq(token.balanceOf(address(fund)), fund.totalStaked());
        assertApproxEqRel(fund.stakeOf(staker), 3 * fund.stakeOf(staker2), 1e6, "every staker in proportion");
        assertApproxEqAbs(fund.stakeOf(staker) + fund.stakeOf(staker2), fund.totalStaked(), 1);
    }

    function test_fund_shortfallSaleStopsAtTheCap() public {
        _stake(staker, 100_000 * SCR);

        vm.prank(address(vault));
        uint256 paid = fund.cover(50_000 * USDC);

        assertEq(fund.totalStaked(), 70_000 * SCR, "30% of the stake at most");
        assertGt(paid, 2_800 * USDC);
        assertLt(paid, 3_000 * USDC);
    }

    function test_fund_shortfallSaleHoldsThePriceFloor() public {
        _stake(staker, 1_000_000 * SCR);
        _pastLaunch();
        _swap(trader, false, -int256(100_000 * SCR)); // the pool price drops about 18%

        vm.prank(address(vault));
        uint256 paid = fund.cover(1_000 * USDC);

        assertEq(paid, 0, "no sale more than 10% under the average price");
        assertEq(fund.totalStaked(), 1_000_000 * SCR);
    }

    function test_fund_shortfallSaleFillsDownToTheFloor() public {
        _stake(staker, 10_000_000 * SCR);

        vm.prank(address(vault));
        uint256 paid = fund.cover(50_000 * USDC);

        // The pool can pay about 4,900 USDC before the price is 10% down.
        assertGt(paid, 4_500 * USDC);
        assertLt(paid, 5_200 * USDC);
        assertGt(fund.totalStaked(), 9_900_000 * SCR);
    }

    function test_fund_smallStreamOverALargeStakeStillPays() public {
        _stake(staker, 500_000_000 * SCR);
        _profitShare(10 * USDC);
        vm.warp(block.timestamp + 90 days);
        assertApproxEqAbs(fund.earned(staker), 6_500_000, 1);
    }

    function test_fund_adminBounds() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, trader));
        vm.prank(trader);
        fund.setSaleLimits(1_000, 500);

        vm.startPrank(admin);
        vm.expectRevert(StakedBackstopFund.OutOfBounds.selector);
        fund.setSaleLimits(3_001, 500);
        vm.expectRevert(StakedBackstopFund.OutOfBounds.selector);
        fund.setSaleLimits(1_000, 3_001);
        vm.expectRevert(StakedBackstopFund.ZeroAddress.selector);
        fund.setTreasury(address(0));
        fund.setTreasury(buyer);
        fund.setVault(address(vault), false);
        vm.stopPrank();
        assertEq(fund.treasury(), buyer);
        assertFalse(fund.isVault(address(vault)));
    }

    function test_fund_callbackOnlyFromPoolManager() public {
        vm.expectRevert(StakedBackstopFund.NotPoolManager.selector);
        fund.unlockCallback("");
    }

    // ───────────────────────── Integration ─────────────────────────

    /// A bucket writes off a loss, the fund has no USDC, and staked SCR makes the
    /// depositors whole.
    function test_integration_writeOffIsCoveredByStakedScr() public {
        _stake(staker, 1_000_000 * SCR);
        desk.lend(800_000 * USDC);
        uint256 navBefore = vault.navNow();

        desk.writeOff(2_000 * USDC);

        assertEq(vault.navNow(), navBefore, "depositors lose nothing");
        assertLt(fund.totalStaked(), 980_000 * SCR);
        assertEq(usdc.balanceOf(address(hook)), 0);
    }

    /// A loss too big for the fund: stakers lose their capped share and the rest
    /// falls on the bucket.
    function test_integration_anUncoveredLossFallsOnTheBucket() public {
        _stake(staker, 100_000 * SCR);
        desk.lend(800_000 * USDC);
        uint256 navBefore = vault.navNow();

        desk.writeOff(50_000 * USDC);

        assertEq(fund.totalStaked(), 70_000 * SCR);
        uint256 lost = navBefore - vault.navNow();
        assertGt(lost, 47_000 * USDC);
        assertLt(lost, 47_200 * USDC);
    }

    /// Pool fees travel hook -> splitter -> treasury and reserve.
    function test_integration_poolFeesReachTheReserve() public {
        _pastLaunch();
        _swap(trader, true, -int256(1_000 * USDC)); // 1% buy fee: 10 USDC
        _swap(trader, false, int256(970 * USDC)); // 3% sell fee, grossed up: 30 USDC
        assertEq(usdc.balanceOf(address(hook)), 40 * USDC);

        hook.forwardTaxes();
        assertEq(usdc.balanceOf(address(splitter)), 40 * USDC);
        splitter.split();

        assertEq(usdc.balanceOf(treasury), 8 * USDC);
        assertEq(usdc.balanceOf(address(reserve)), 32 * USDC);
        assertEq(usdc.balanceOf(address(hook)) + usdc.balanceOf(address(splitter)), 0);
    }

    /// The launch fee is live from the first block and decays without anyone acting.
    function test_integration_launchFeeDecays() public {
        _swap(trader, true, -int256(1_000 * USDC));
        assertEq(usdc.balanceOf(address(hook)), 200 * USDC, "20% at the open");

        _pastLaunch();
        _swap(trader, true, -int256(1_000 * USDC));
        assertEq(usdc.balanceOf(address(hook)), 210 * USDC, "1% at the floor");
    }

    /// SCR bought in the sale trades in the pool, pays the fee, and cannot go round it.
    function test_integration_soldScrTradesOnlyThroughTheTaxedPool() public {
        _pastLaunch();
        vm.prank(buyer);
        sale.buy(50_000 * SCR, type(uint256).max);

        // Delivered staked, so the buyer waits out the cooldown before selling.
        vm.startPrank(buyer);
        fund.requestUnstake(50_000 * SCR);
        vm.warp(block.timestamp + 14 days);
        fund.unstake();
        vm.stopPrank();
        _swap(buyer, false, -int256(50_000 * SCR));
        assertGt(usdc.balanceOf(address(hook)), 0);
        assertEq(token.balanceOf(buyer), 0);

        PoolKey memory untaxed = _key();
        untaxed.hooks = IHooks(address(0));
        router.initialize(untaxed, _sqrtPrice());
        vm.prank(distributor);
        token.approve(address(router), type(uint256).max);
        (int24 lower, int24 upper) = _scrOnlyRange();
        vm.expectRevert();
        vm.prank(distributor);
        router.modifyLiquidity(untaxed, IPoolManager.ModifyLiquidityParams(lower, upper, 1e18, bytes32(0)));
    }

    /// The whole loop: trading and a sale fill the reserve, a bucket runs short, the
    /// reserve covers the withdrawal queue, and comes back out whole.
    function test_integration_reserveIsFilledThenRescuesABucket() public {
        _pastLaunch();

        // 1. Trading fees.
        _swap(trader, true, -int256(5_000 * USDC));
        _swap(trader, false, -int256(40_000 * SCR));
        hook.forwardTaxes();
        splitter.split();
        uint256 fromFees = usdc.balanceOf(address(reserve));
        assertGt(fromFees, 0);
        assertApproxEqAbs(usdc.balanceOf(treasury) * 4, fromFees, 4, "a fifth to the treasury, the rest to the reserve");

        // 2. Reserve sales at the weekly cap until the reserve passes its target.
        uint256 fromSales;
        vm.startPrank(buyer);
        for (uint256 week; week < 3; ++week) {
            uint256 before = _valuePerToken();
            fromSales += sale.buy(500_000 * SCR, type(uint256).max);
            assertGe(_valuePerToken(), before);
            vm.warp(block.timestamp + 7 days);
        }
        vm.expectRevert(ReserveSale.Closed.selector);
        sale.buy(1 * SCR, type(uint256).max);
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(reserve)), fromFees + fromSales);
        assertEq(token.totalSupply(), 901_500_000 * SCR);
        assertGt(fromSales, 140_000 * USDC);
        assertFalse(sale.isOpen(), "the reserve passed its target, so sales closed");

        // 3. The bucket runs short and the reserve steps in.
        uint256 reserveBefore = reserve.totalAssets();
        _makeShort(950_000 * USDC, 190_000 * USDC); // 50,000 idle against 190,000 queued
        assertEq(reserve.shortage(vault), 140_000 * USDC);
        vm.prank(keeper);
        reserve.deposit(vault, 140_000 * USDC);
        _cutoff();
        vault.claimWithdraw(alice);
        assertEq(usdc.balanceOf(alice), 190_000 * USDC, "the withdrawal is paid in full");
        reserve.claim(vault);
        assertEq(reserve.totalAssets(), reserveBefore);

        // 4. Tickets repay with markup, and the reserve leaves with its share of it.
        usdc.mint(address(desk), 10_000 * USDC);
        desk.repay(950_000 * USDC, 10_000 * USDC);
        _cutoff();
        uint256 shares = vault.balanceOf(address(reserve));
        vm.prank(keeper);
        reserve.requestWithdraw(vault, shares);
        _cutoff();
        reserve.claim(vault);

        assertEq(reserve.deployed(vault), 0);
        assertGt(usdc.balanceOf(address(reserve)), reserveBefore, "it earned like any depositor");
    }
}

contract SacredSystemUsdcFirstTest is SacredSystemTest {
    function _usdcAddress() internal pure override returns (address) {
        return address(0x1000);
    }
}

contract SacredSystemScrFirstTest is SacredSystemTest {
    function _usdcAddress() internal pure override returns (address) {
        return address(type(uint160).max - 0xff);
    }
}
