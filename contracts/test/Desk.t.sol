// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {Desk} from "../src/Desk.sol";
import {Vault} from "../src/Vault.sol";
import {Oracle} from "../src/Oracle.sol";
import {TicketMath} from "../src/TicketMath.sol";

contract DeskTest is Base {
    uint256 internal constant MARKUP = 8_438_356; // 2,000 x 11% x 14 / 365

    function setUp() public override {
        super.setUp();
        seed();
    }

    // ── opening ──

    function test_open_recordsTheDesignExample() public {
        uint256 id = openExample();
        Desk.Ticket memory t = ticket(id);
        assertEq(t.owner, trader);
        assertEq(uint8(t.status), uint8(Desk.Status.Live));
        assertEq(t.cost, 3_000 * USDC);
        assertEq(t.downPayment, 1_000 * USDC);
        assertEq(t.financed, 2_000 * USDC);
        assertEq(t.markup, MARKUP);
        assertEq(t.qty, 5_000_000); // 0.05 BTC
        assertEq(t.due, t.opened + 14 days);
        assertEq(coin.balanceOf(address(desk)), t.qty, "coin pledged in the desk");
        assertEq(vault.lent(), 2_000 * USDC);
        assertEq(vault.idle(), 98_000 * USDC);
        assertEq(usdc.balanceOf(address(desk)), 0);
        assertEq(desk.liveCount(), 1);
    }

    function test_open_surchargeOnlyAboveTwoX() public view {
        assertEq(desk.rateBps(20_000), 1_000);
        assertEq(desk.rateBps(20_001), 1_100);
    }

    function test_open_revertsForStrangers() public {
        vm.prank(alice);
        vm.expectRevert(Desk.NotAllowed.selector);
        desk.open(1_000 * USDC, 20_000, 7 days, 0);
    }

    function test_open_revertsOnBadLeverage() public {
        vm.startPrank(trader);
        vm.expectRevert(Desk.BadLeverage.selector);
        desk.open(1_000 * USDC, 10_000, 7 days, 0);
        vm.expectRevert(Desk.BadLeverage.selector);
        desk.open(1_000 * USDC, 30_001, 7 days, 0);
    }

    function test_open_revertsOnBadTerm() public {
        vm.prank(trader);
        vm.expectRevert(Desk.BadTerm.selector);
        desk.open(1_000 * USDC, 20_000, 10 days, 0);
    }

    function test_open_revertsWhenTooLarge() public {
        vm.prank(trader);
        vm.expectRevert(Desk.TooLarge.selector);
        desk.open(40_000 * USDC, 30_000, 7 days, 0);
    }

    function test_open_revertsAboveUtilisationCap() public {
        vm.startPrank(admin);
        desk.setParams(1_000, 100, 20_000, 30_000, 1_000_000 * USDC, 200);
        vault.setParams(1_000_000 * USDC, 5_000, 1_000, 500, 500); // cap at 50%
        vm.stopPrank();
        vm.prank(trader);
        vm.expectRevert(Vault.Unhealthy.selector);
        desk.open(30_000 * USDC, 30_000, 7 days, 0); // finances 60,000 of 100,000
    }

    function test_open_revertsWhenCashIsNeededForWithdrawals() public {
        vm.prank(alice);
        vault.requestWithdraw(89_000 * USDC);
        vm.prank(trader);
        vm.expectRevert(Vault.Unhealthy.selector);
        desk.open(6_000 * USDC, 30_000, 7 days, 0); // would leave 88,000 idle
    }

    function test_open_revertsWhenMarketPriceIsFarFromFeed() public {
        router.setSlip(200); // 2% worse than the feed; tolerance is 1%
        vm.prank(trader);
        vm.expectRevert("Too little received");
        desk.open(1_000 * USDC, 30_000, 14 days, 0);
    }

    function test_open_honoursTraderPriceLimit() public {
        vm.prank(trader);
        vm.expectRevert("Too little received");
        desk.open(1_000 * USDC, 30_000, 14 days, 5_000_001);
    }

    function test_open_revertsBelowMinimumDownPayment() public {
        vm.prank(trader);
        vm.expectRevert(Desk.TooSmall.selector);
        desk.open(99 * USDC, 30_000, 14 days, 0);
        vm.prank(admin);
        vm.expectRevert(Desk.OutOfBounds.selector);
        desk.setMinDownPayment(10_001 * USDC);
    }

    function test_open_respectsMaxLive() public {
        vm.prank(admin);
        desk.setParams(1_000, 100, 20_000, 30_000, 100_000 * USDC, 1);
        openExample();
        vm.prank(trader);
        vm.expectRevert(Desk.TooManyTickets.selector);
        desk.open(1_000 * USDC, 30_000, 14 days, 0);
    }

    function test_pause_blocksOpeningOnly() public {
        uint256 id = openExample();
        vm.prank(guardian);
        desk.pauseOpening(true);
        vm.prank(trader);
        vm.expectRevert(Desk.Paused.selector);
        desk.open(1_000 * USDC, 30_000, 14 days, 0);
        vm.prank(trader);
        desk.close(id, 0); // exits still work
    }

    function test_pause_guardianCannotUnpause() public {
        vm.prank(guardian);
        desk.pauseOpening(true);
        vm.prank(guardian);
        vm.expectRevert(Desk.NotAllowed.selector);
        desk.pauseOpening(false);
        vm.prank(admin);
        desk.pauseOpening(false);
    }

    // ── closing ──

    function test_close_earlyMatchesTheDesignExample() public {
        uint256 id = openExample();
        skipFresh(5 days);
        setPrice(66_000); // +10%
        uint256 s = desk.settlementAmount(id);
        assertEq(s, 2_000 * USDC + MARKUP * 5 / 14, "2,003.01");

        uint256 before = usdc.balanceOf(trader);
        vm.prank(trader);
        desk.close(id, 0);

        uint256 surplus = 3_300 * USDC - s;
        uint256 share = (surplus - 1_000 * USDC) * 3_000 / 10_000;
        assertEq(usdc.balanceOf(trader) - before, surplus - share);
        assertEq(usdc.balanceOf(address(fund)), share);
        assertEq(vault.lent(), 0);
        assertEq(coin.balanceOf(address(desk)), 0);
        assertEq(uint8(ticket(id).status), uint8(Desk.Status.Closed));
        assertEq(desk.liveCount(), 0);
        // The vault got exactly the settlement amount: principal plus five days of markup.
        assertEq(vault.idle() + vault.reserve(), 100_000 * USDC + MARKUP * 5 / 14);
    }

    function test_close_sameDayStillEarnsOneDay() public {
        uint256 id = openExample();
        assertEq(desk.settlementAmount(id), 2_000 * USDC + MARKUP / 14);
    }

    function test_close_noProfitNoShare() public {
        uint256 id = openExample();
        skipFresh(5 days);
        setPrice(57_000); // -5%: trader loses, shares nothing
        vm.prank(trader);
        desk.close(id, 0);
        assertEq(usdc.balanceOf(address(fund)), 0);
    }

    function test_close_revertsWhenSaleWouldNotCoverSettlement() public {
        uint256 id = openExample();
        setPrice(36_000); // -40%: coin worth 1,800
        vm.prank(trader);
        vm.expectRevert(Desk.SaleBelowSettlement.selector);
        desk.close(id, 0);
    }

    function test_close_onlyOwner() public {
        uint256 id = openExample();
        vm.prank(alice);
        vm.expectRevert(Desk.NotOwner.selector);
        desk.close(id, 0);
    }

    function test_close_twiceReverts() public {
        uint256 id = openExample();
        vm.startPrank(trader);
        desk.close(id, 0);
        vm.expectRevert(Desk.NotLive.selector);
        desk.close(id, 0);
    }

    function test_close_worksWhenFeedIsStale() public {
        uint256 id = openExample();
        skip(2 days); // feed not refreshed
        vm.prank(trader);
        desk.close(id, 2_900 * USDC);
        assertEq(desk.liveCount(), 0);
    }

    // ── paying off ──

    function test_payOff_releasesCoinAndChargesShareFromFeed() public {
        uint256 id = openExample();
        skipFresh(14 days);
        setPrice(72_000); // +20%: coin worth 3,600
        uint256 s = desk.settlementAmount(id);
        assertEq(s, 2_000 * USDC + MARKUP);
        uint256 share = (3_600 * USDC - s - 1_000 * USDC) * 3_000 / 10_000; // 177.47
        assertApproxEqAbs(share, 177_468_493, 1);

        uint256 before = usdc.balanceOf(trader);
        vm.prank(trader);
        desk.payOff(id);
        assertEq(before - usdc.balanceOf(trader), s + share);
        assertEq(coin.balanceOf(trader), 5_000_000);
        assertEq(coin.balanceOf(address(desk)), 0);
        assertEq(usdc.balanceOf(address(fund)), share);
        assertEq(uint8(ticket(id).status), uint8(Desk.Status.PaidOff));
    }

    function test_payOff_worksWhenFeedIsStale_shareIsZero() public {
        uint256 id = openExample();
        skip(3 days);
        vm.prank(trader);
        desk.payOff(id);
        assertEq(coin.balanceOf(trader), 5_000_000);
        assertEq(usdc.balanceOf(address(fund)), 0);
    }

    // ── part payment ──

    function test_partPay_reducesBalanceAndKeepsPledge() public {
        uint256 id = openExample();
        uint256 s0 = desk.settlementAmount(id);
        vm.prank(trader);
        desk.partPay(id, 500 * USDC);
        assertEq(desk.settlementAmount(id), s0 - 500 * USDC);
        assertEq(vault.lent(), 1_500 * USDC);
        assertEq(coin.balanceOf(address(desk)), 5_000_000);
    }

    function test_partPay_revertsAtOrAboveSettlement() public {
        uint256 id = openExample();
        uint256 s = desk.settlementAmount(id);
        vm.startPrank(trader);
        vm.expectRevert(Desk.BadAmount.selector);
        desk.partPay(id, s);
        vm.expectRevert(Desk.BadAmount.selector);
        desk.partPay(id, 0);
    }

    function test_partPay_thenClose_countsPartPaymentAsPaidIn() public {
        uint256 id = openExample();
        vm.prank(trader);
        desk.partPay(id, 500 * USDC);
        skipFresh(14 days);
        setPrice(72_000);
        uint256 s = desk.settlementAmount(id);
        vm.prank(trader);
        desk.close(id, 0);
        // profit = (3,600 - s) - (1,000 + 500)
        assertEq(usdc.balanceOf(address(fund)), (3_600 * USDC - s - 1_500 * USDC) * 3_000 / 10_000);
    }

    // ── settlement ──

    function test_settle_revertsBeforeDue() public {
        uint256 id = openExample();
        skipFresh(14 days); // exactly at the due date is still not past it
        vm.expectRevert(Desk.NotDue.selector);
        desk.settle(id);
    }

    function test_settle_inProfit_creditsTraderAndPaysKeeper() public {
        uint256 id = openExample();
        skipFresh(14 days + 1);
        setPrice(72_000);
        vm.prank(keeper);
        desk.settle(id);

        uint256 net = 3_600 * USDC - 1 * USDC;
        uint256 surplus = net - (2_000 * USDC + MARKUP);
        uint256 share = (surplus - 1_000 * USDC) * 3_000 / 10_000;
        assertEq(usdc.balanceOf(keeper), 1 * USDC);
        assertEq(desk.owed(trader), surplus - share);
        assertEq(usdc.balanceOf(address(desk)), desk.totalOwed());
        assertEq(uint8(ticket(id).status), uint8(Desk.Status.Settled));

        uint256 before = usdc.balanceOf(trader);
        vm.prank(trader);
        desk.claimOwed();
        assertEq(usdc.balanceOf(trader) - before, surplus - share);
        assertEq(desk.totalOwed(), 0);
    }

    function test_settle_short_traderOwesNothing_reserveThenFundThenDepositors() public {
        // Give the fund 100 USDC to cover with.
        usdc.mint(address(this), 125 * USDC);
        usdc.approve(address(fund), 125 * USDC);
        fund.receiveShare(125 * USDC); // 25 to the treasury, 100 available
        uint256 id = openExample();
        skipFresh(14 days + 1);
        setPrice(36_000); // -40%: coin sells for 1,800

        uint256 traderBefore = usdc.balanceOf(trader);
        vm.prank(keeper);
        desk.settle(id);

        assertEq(uint8(ticket(id).status), uint8(Desk.Status.SettledShort));
        assertEq(usdc.balanceOf(trader), traderBefore, "trader pays nothing more");
        assertEq(desk.owed(trader), 0);
        assertEq(vault.lent(), 0);
        // Principal 2,000; received 1,799 after the keeper fee; shortfall 201.
        // Reserve was empty, the fund paid 100, depositors bear 101.
        assertEq(fund.available(), 0);
        assertEq(vault.idle(), 100_000 * USDC - 101 * USDC);
        assertEq(usdc.balanceOf(address(vault)), vaultBacked());
    }

    function test_settle_revertsWhenFeedIsStale() public {
        uint256 id = openExample();
        skip(15 days);
        vm.expectRevert(Oracle.StalePrice.selector);
        desk.settle(id);
    }

    function test_settle_revertsWhenMarketIsBelowFloor() public {
        uint256 id = openExample();
        skipFresh(15 days);
        router.setSlip(200);
        vm.expectRevert("Too little received");
        desk.settle(id);
    }

    function test_noOneCanSellBeforeDueExceptTheTrader() public {
        uint256 id = openExample();
        setPrice(30_000); // deep under water, still no forced sale
        skipFresh(13 days);
        vm.expectRevert(Desk.NotDue.selector);
        desk.settle(id);
        assertEq(coin.balanceOf(address(desk)), 5_000_000);
    }

    // ── book value ──

    function test_bookValue_lowerOfSettlementAndCoinValue() public {
        uint256 id = openExample();
        (uint256 book, uint256 shortfall) = desk.bookValue();
        assertEq(book, desk.settlementAmount(id));
        assertEq(shortfall, 0);
        setPrice(36_000);
        (book, shortfall) = desk.bookValue();
        assertEq(book, 1_800 * USDC);
        assertEq(shortfall, desk.settlementAmount(id) - 1_800 * USDC);
    }

    // ── admin bounds ──

    function test_admin_cannotExceedHardLimits() public {
        vm.startPrank(admin);
        vm.expectRevert(Desk.OutOfBounds.selector);
        desk.setParams(5_000, 1, 20_000, 30_000, 1, 1);
        vm.expectRevert(Desk.OutOfBounds.selector);
        desk.setParams(1_000, 100, 20_000, 30_001, 1, 1);
        vm.expectRevert(Desk.OutOfBounds.selector);
        desk.setParams(1_000, 100, 20_000, 30_000, 1, 501);
        vm.expectRevert(Desk.OutOfBounds.selector);
        desk.setSaleParams(501, 0);
        vm.expectRevert(Desk.OutOfBounds.selector);
        desk.setSaleParams(100, 21e6);
        vm.expectRevert(Desk.OutOfBounds.selector);
        desk.setTerm(31 days, true);
    }

    function test_admin_onlyOwner() public {
        vm.expectRevert();
        desk.setParams(1, 1, 1, 1, 1, 1);
        vm.expectRevert();
        desk.setTrader(alice, true);
    }

    function test_paramChangeDoesNotTouchLiveTicket() public {
        uint256 id = openExample();
        vm.prank(admin);
        desk.setParams(4_000, 100, 20_000, 30_000, 100_000 * USDC, 200);
        assertEq(ticket(id).markup, MARKUP);
    }

    // ── fuzz ──

    /// Any ticket, any price path, any exit time: the vault never receives more than
    /// principal plus markup, the trader never pays more than they chose to, and the
    /// desk ends empty.
    function testFuzz_lifecycle(uint256 dp, uint256 lev, uint256 priceAtExit, uint256 wait, uint8 exit) public {
        dp = bound(dp, 100 * USDC, 10_000 * USDC);
        lev = bound(lev, 10_100, 30_000);
        priceAtExit = bound(priceAtExit, 20_000, 200_000);
        wait = bound(wait, 0, 20 days);
        vm.prank(trader);
        uint256 id = desk.open(dp, lev, 14 days, 0);
        Desk.Ticket memory t = ticket(id);
        uint256 vaultBefore = vault.idle() + vault.reserve();
        uint256 traderBefore = usdc.balanceOf(trader);

        skipFresh(wait);
        setPrice(priceAtExit);
        uint256 s = desk.settlementAmount(id);
        uint256 coinValue = oracle.value(t.qty);

        if (wait > 14 days) {
            desk.settle(id);
            assertGe(usdc.balanceOf(trader), traderBefore, "settlement never takes from the trader");
        } else if (exit % 2 == 0) {
            vm.prank(trader);
            if (coinValue < s) {
                vm.expectRevert(Desk.SaleBelowSettlement.selector);
                desk.close(id, 0);
                return;
            }
            desk.close(id, 0);
            assertGe(usdc.balanceOf(trader), traderBefore);
        } else {
            vm.prank(trader);
            desk.payOff(id);
            assertEq(coin.balanceOf(trader), t.qty);
        }
        uint256 vaultGain = vault.idle() + vault.reserve() - (vaultBefore - 0);
        assertLe(vaultGain, t.financed + t.markup, "vault never gets more than the balance");
        assertEq(vault.lent(), 0);
        assertEq(coin.balanceOf(address(desk)), 0);
        assertEq(usdc.balanceOf(address(desk)), desk.totalOwed());
        assertEq(usdc.balanceOf(address(vault)), vaultBacked());
    }

    function testFuzz_settlementNeverDecreasesOverTimeAndNeverExceedsBalance(uint256 a, uint256 b) public {
        uint256 id = openExample();
        a = bound(a, 0, 30 days);
        b = bound(b, a, 30 days);
        uint256 t0 = block.timestamp;
        vm.warp(t0 + a);
        uint256 sa = desk.settlementAmount(id);
        vm.warp(t0 + b);
        uint256 sb = desk.settlementAmount(id);
        assertLe(sa, sb);
        assertLe(sb, 2_000 * USDC + MARKUP);
    }
}
