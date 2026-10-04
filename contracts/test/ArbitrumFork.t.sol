// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {DeployToken} from "../script/DeployToken.s.sol";
import {Vault} from "../src/Vault.sol";
import {Desk} from "../src/Desk.sol";
import {StakedBackstopFund} from "../src/StakedBackstopFund.sol";
import {V4Router} from "./TaxHook.t.sol";

/// Runs both deploy scripts, as they would be run, against a fork of Arbitrum One, and
/// drives the result through the real Uniswap v3 WBTC/USDC pool, the real Chainlink
/// BTC/USD and sequencer feeds, and the real Uniswap v4 PoolManager.
///
/// Skipped unless ARBITRUM_RPC_URL is set:
///   ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc forge test --match-contract ArbitrumFork
contract ArbitrumForkTest is Test {
    uint256 internal constant USDC_UNIT = 1e6;
    uint256 internal constant SCR = 1e18;
    uint256 internal constant DEPLOYER_KEY = 0xA11CE;

    address internal constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address internal constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
    address internal constant BTC_USD_FEED = 0x6ce185860a4963106506C203335A2910413708e9;
    address internal constant SEQUENCER_FEED = 0xFdB631F5EE196F0ed6FAa767959853A9F217697D;
    address internal constant SWAP_ROUTER_02 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address internal constant V4_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;

    address internal deployer = vm.addr(DEPLOYER_KEY);
    address internal multisig = makeAddr("multisig");
    address internal treasury = makeAddr("treasury");
    address internal guardian = makeAddr("guardian");
    address internal distributor = makeAddr("distributor");
    address internal manager = makeAddr("manager");
    address internal alice = makeAddr("alice");
    address internal trader = makeAddr("trader");

    DeployToken internal scr;
    Deploy internal bucket;
    Vault internal vault;
    Desk internal desk;
    IERC20 internal usdc = IERC20(USDC);

    function setUp() public {
        string memory rpc = vm.envOr("ARBITRUM_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        vm.etch(multisig, hex"00"); // the scripts insist on a contract multisig here

        vm.setEnv("PRIVATE_KEY", vm.toString(DEPLOYER_KEY));
        vm.setEnv("MULTISIG", vm.toString(multisig));
        vm.setEnv("TREASURY", vm.toString(treasury));
        vm.setEnv("GUARDIAN", vm.toString(guardian));
        vm.setEnv("DISTRIBUTOR", vm.toString(distributor));
        vm.setEnv("POOL_MANAGER", vm.toString(V4_POOL_MANAGER));
        vm.setEnv("USDC", vm.toString(USDC));
        scr = new DeployToken();
        scr.run();

        vm.setEnv("TIMELOCK", vm.toString(scr.timelock()));
        vm.setEnv("FUND", vm.toString(address(scr.fund())));
        vm.setEnv("RESERVE", vm.toString(address(scr.reserve())));
        vm.setEnv("MANAGER", vm.toString(manager));
        vm.setEnv("USDC", vm.toString(USDC));
        vm.setEnv("COIN", vm.toString(WBTC));
        vm.setEnv("COIN_DECIMALS", "8");
        vm.setEnv("FEED", vm.toString(BTC_USD_FEED));
        vm.setEnv("SEQUENCER_FEED", vm.toString(SEQUENCER_FEED));
        vm.setEnv("ROUTER", vm.toString(SWAP_ROUTER_02));
        vm.setEnv("POOL_FEE", "500");
        vm.setEnv("FEED_MAX_AGE", "2592000"); // the test warps; production uses the feed's heartbeat
        vm.setEnv("MAX_LEVERAGE_BPS", "30000");
        vm.setEnv("BUCKET_CAP", "1000000000000");
        vm.setEnv("FIRST_CUTOFF", vm.toString(block.timestamp + 1 hours));
        vm.setEnv("NAME", "Sacred BTC Term");
        bucket = new Deploy();
        bucket.run();
        vault = bucket.vault();
        desk = bucket.desk();

        vm.startPrank(deployer); // still the owner until the time-lock accepts
        vault.setDepositor(alice, true);
        desk.setTrader(trader, true);
        vm.stopPrank();
    }

    function _seedBucket() internal {
        deal(USDC, manager, 10_000 * USDC_UNIT);
        deal(USDC, alice, 90_000 * USDC_UNIT);
        vm.startPrank(manager);
        usdc.approve(address(vault), type(uint256).max);
        vault.requestDeposit(10_000 * USDC_UNIT);
        vm.stopPrank();
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.requestDeposit(90_000 * USDC_UNIT);
        vm.stopPrank();
        vm.warp(vault.nextCutoff());
        vault.cutoff();
    }

    function _key() internal view returns (PoolKey memory) {
        address token = address(scr.token());
        (address c0, address c1) = scr.hook().usdcIsCurrency0() ? (USDC, token) : (token, USDC);
        return PoolKey(Currency.wrap(c0), Currency.wrap(c1), 3000, 60, IHooks(address(scr.hook())));
    }

    /// The deployer opens the SCR/USDC pool at 0.10 USDC with protocol liquidity.
    function _openScrPool() internal {
        address liquidity = address(scr.liquidity());
        IERC20 token = IERC20(address(scr.token()));
        deal(USDC, liquidity, 100_000 * USDC_UNIT);
        vm.prank(distributor);
        token.transfer(liquidity, 1_000_000 * SCR);
        uint256 ratioX192 = scr.hook().usdcIsCurrency0() ? uint256(1e13) << 192 : (uint256(1) << 192) / 1e13;

        vm.startPrank(deployer);
        scr.liquidity().openPool(_key(), uint160(FixedPointMathLib.sqrt(ratioX192)));
        scr.liquidity().addLiquidity(
            TickMath.minUsableTick(60), TickMath.maxUsableTick(60), 3e17, type(uint256).max, type(uint256).max
        );
        vm.stopPrank();
    }

    function test_fork_deployedSystemIsWired() public view {
        assertEq(block.chainid, 42161);
        assertEq(bucket.timelock(), scr.timelock());
        assertEq(address(vault.fund()), address(scr.fund()));
        assertTrue(scr.fund().isVault(address(vault)));
        assertTrue(scr.reserve().isListed(address(vault)));
        assertTrue(vault.depositorAllowed(address(scr.reserve())));
        assertEq(vault.pendingOwner(), scr.timelock());
        assertEq(desk.pendingOwner(), scr.timelock());
        assertEq(scr.fund().pendingOwner(), scr.timelock());
        assertEq(address(bucket.oracle().sequencerFeed()), SEQUENCER_FEED);
        assertEq(uint160(address(scr.hook())) & Hooks.ALL_HOOK_MASK, uint160(0x2DCD));
    }

    /// A 3x BTC ticket bought and sold on the real pool, priced by the real feed.
    function test_fork_ticketOpensAndClosesOnUniswap() public {
        _seedBucket();
        deal(USDC, trader, 5_000 * USDC_UNIT);
        uint256 btcPrice = bucket.oracle().value(1e8); // USDC for one BTC

        vm.startPrank(trader);
        usdc.approve(address(desk), type(uint256).max);
        uint256 id = desk.open(1_000 * USDC_UNIT, 30_000, 14 days, 0);
        vm.stopPrank();

        uint256 held = IERC20(WBTC).balanceOf(address(desk));
        assertApproxEqRel(held * btcPrice / 1e8, 3_000 * USDC_UNIT, 0.01e18, "3,000 USDC of BTC, within 1%");
        assertEq(vault.lent(), 2_000 * USDC_UNIT);

        vm.prank(trader);
        desk.close(id, 0);

        assertEq(IERC20(WBTC).balanceOf(address(desk)), 0);
        assertEq(vault.lent(), 0);
        assertGe(vault.navNow(), 100_000 * USDC_UNIT, "the bucket is repaid in full");
        assertGt(usdc.balanceOf(trader), 4_950 * USDC_UNIT, "the round trip costs the trader under 1% of cost");
        assertLt(usdc.balanceOf(trader), 5_000 * USDC_UNIT);
    }

    /// The hooked SCR pool on the real PoolManager: a buy pays the launch fee, and the
    /// fee reaches the treasury, the reserve and the fund.
    function test_fork_scrPoolTradesAndFeesAreSplit() public {
        _openScrPool();
        V4Router router = new V4Router(IPoolManager(V4_POOL_MANAGER));
        deal(USDC, trader, 1_000 * USDC_UNIT);
        bool usdcFirst = scr.hook().usdcIsCurrency0();

        vm.startPrank(trader);
        usdc.approve(address(router), type(uint256).max);
        router.swap(
            _key(),
            IPoolManager.SwapParams(
                usdcFirst, -int256(1_000 * USDC_UNIT), usdcFirst ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            )
        );
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(scr.hook())), 200 * USDC_UNIT, "the 20% launch fee");
        assertGt(scr.token().balanceOf(trader), 7_000 * SCR);

        scr.hook().forwardTaxes();
        scr.splitter().split();
        assertEq(usdc.balanceOf(treasury), 40 * USDC_UNIT);
        assertEq(usdc.balanceOf(address(scr.reserve())) + scr.fund().available(), 160 * USDC_UNIT);
    }

    /// A reserve sale against the live pool: paid in USDC to the reserve, delivered staked.
    function test_fork_reserveSaleDeliversStaked() public {
        _seedBucket();
        _openScrPool();
        vm.warp(block.timestamp + 1 hours);
        deal(USDC, trader, 2_000 * USDC_UNIT);

        vm.startPrank(trader);
        usdc.approve(address(scr.sale()), type(uint256).max);
        uint256 cost = scr.sale().buy(10_000 * SCR, type(uint256).max);
        vm.stopPrank();

        assertApproxEqRel(cost, 960 * USDC_UNIT, 0.001e18); // 0.10 less the 4% discount
        assertEq(usdc.balanceOf(address(scr.reserve())), cost);
        assertEq(scr.fund().stakeOf(trader), 10_000 * SCR);
    }

    /// A bucket loss with no USDC in the fund is covered by selling staked SCR.
    function test_fork_writeOffIsCoveredByStakedScr() public {
        _seedBucket();
        _openScrPool();
        IERC20 token = IERC20(address(scr.token()));
        vm.startPrank(distributor);
        token.approve(address(scr.fund()), 1_000_000 * SCR);
        scr.fund().stake(1_000_000 * SCR);
        vm.stopPrank();

        StakedBackstopFund fund = scr.fund();
        vm.prank(address(vault));
        uint256 paid = fund.cover(2_000 * USDC_UNIT);

        assertEq(paid, 2_000 * USDC_UNIT);
        assertLt(fund.totalStaked(), 980_000 * SCR);
        assertEq(usdc.balanceOf(address(scr.hook())), 0, "the fund pays no pool fee");
    }
}
