// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault, IBackstopFund} from "../src/Vault.sol";
import {Desk, IVault, IFund} from "../src/Desk.sol";
import {Oracle} from "../src/Oracle.sol";
import {BackstopFund} from "../src/BackstopFund.sol";
import {IAggregatorV3, ISwapRouter} from "../src/interfaces/External.sol";
import {MockERC20, MockFeed, MockRouter} from "../src/mocks/Mocks.sol";

/// Shared fixture: a BTC term bucket wired to mocks, at a BTC price of 60,000.
abstract contract Base is Test {
    uint256 internal constant USDC = 1e6;
    uint256 internal constant BTC = 1e8;
    uint256 internal constant PRICE0 = 60_000;

    address internal admin = makeAddr("admin");
    address internal manager = makeAddr("manager");
    address internal guardian = makeAddr("guardian");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice"); // depositor
    address internal bob = makeAddr("bob"); // depositor
    address internal trader = makeAddr("trader");
    address internal keeper = makeAddr("keeper");

    MockERC20 internal usdc;
    MockERC20 internal coin;
    MockFeed internal feed;
    MockRouter internal router;
    Oracle internal oracle;
    BackstopFund internal fund;
    Vault internal vault;
    Desk internal desk;

    function setUp() public virtual {
        vm.warp(1_760_000_000);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        coin = new MockERC20("Wrapped BTC", "WBTC", 8);
        feed = new MockFeed(8, int256(PRICE0 * 1e8));
        router = new MockRouter(usdc, coin, PRICE0 * USDC);
        oracle = new Oracle(IAggregatorV3(address(feed)), IAggregatorV3(address(0)), 1 hours, 8);
        fund = new BackstopFund(IERC20(address(usdc)), treasury, admin);
        vault = new Vault(IERC20(address(usdc)), manager, admin, 1_000_000 * USDC, block.timestamp + 7 days, "Destiny BTC Term");
        desk = new Desk(
            IERC20(address(usdc)),
            IERC20(address(coin)),
            IVault(address(vault)),
            ISwapRouter(address(router)),
            500,
            oracle,
            IFund(address(fund)),
            30_000,
            admin
        );
        vm.startPrank(admin);
        vault.setDesk(address(desk));
        vault.setFund(IBackstopFund(address(fund)));
        vault.setGuardian(guardian);
        vault.setDepositor(alice, true);
        vault.setDepositor(bob, true);
        desk.setGuardian(guardian);
        desk.setTrader(trader, true);
        fund.setVault(address(vault), true);
        vm.stopPrank();

        for (uint256 i; i < 4; ++i) {
            address u = [manager, alice, bob, trader][i];
            usdc.mint(u, 10_000_000 * USDC);
            vm.startPrank(u);
            usdc.approve(address(vault), type(uint256).max);
            usdc.approve(address(desk), type(uint256).max);
            vm.stopPrank();
        }
    }

    // ── helpers ──

    function setPrice(uint256 usdPerCoin) internal {
        feed.set(int256(usdPerCoin * 1e8));
        router.setPrice(usdPerCoin * USDC);
    }

    function skipFresh(uint256 secs) internal {
        skip(secs);
        feed.setUpdatedAt(block.timestamp);
    }

    function deposit(address user, uint256 assets) internal {
        vm.prank(user);
        vault.requestDeposit(assets);
    }

    function doCutoff() internal {
        if (block.timestamp < vault.nextCutoff()) vm.warp(vault.nextCutoff());
        feed.setUpdatedAt(block.timestamp);
        vault.cutoff();
    }

    /// Manager and Alice fund the bucket with 100,000 USDC and it is processed.
    function seed() internal {
        deposit(manager, 10_000 * USDC);
        deposit(alice, 90_000 * USDC);
        doCutoff();
        vault.claimDeposit(manager);
        vault.claimDeposit(alice);
    }

    /// The running example: 1,000 USDC down on BTC at 3x for 14 days.
    function openExample() internal returns (uint256 id) {
        vm.prank(trader);
        id = desk.open(1_000 * USDC, 30_000, 14 days, 0);
    }

    function ticket(uint256 id) internal view returns (Desk.Ticket memory) {
        return desk.getTicket(id);
    }

    function vaultBacked() internal view returns (uint256) {
        return vault.idle() + vault.queuedDeposits() + vault.reserve() + vault.claimable();
    }
}
