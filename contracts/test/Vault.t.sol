// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {Vault} from "../src/Vault.sol";
import {BackstopFund} from "../src/BackstopFund.sol";
import {Oracle} from "../src/Oracle.sol";
import {IAggregatorV3} from "../src/interfaces/External.sol";
import {MockFeed} from "../src/mocks/Mocks.sol";

contract VaultTest is Base {
    // ── deposits ──

    function test_deposit_queuesThenMintsAtCutoff() public {
        deposit(manager, 10_000 * USDC);
        deposit(alice, 90_000 * USDC);
        assertEq(vault.queuedDeposits(), 100_000 * USDC);
        assertEq(vault.totalSupply(), 0, "queued deposits hold no shares");
        doCutoff();
        vault.claimDeposit(alice);
        vault.claimDeposit(manager);
        assertEq(vault.balanceOf(alice), 90_000 * USDC);
        assertEq(vault.balanceOf(manager), 10_000 * USDC);
        assertEq(vault.idle(), 100_000 * USDC);
        assertEq(vault.queuedDeposits(), 0);
        assertEq(vault.lastPrice(), 1e18);
    }

    function test_deposit_revertsForStrangersWhileAllowlistIsOn() public {
        vm.prank(trader);
        vm.expectRevert(Vault.NotAllowed.selector);
        vault.requestDeposit(1 * USDC);
        vm.prank(admin);
        vault.setAllowlist(false);
        deposit(manager, 1_000 * USDC);
        deposit(trader, 1 * USDC);
    }

    function test_deposit_refusedIfManagerShareWouldFallBelowMinimum() public {
        deposit(manager, 1_000 * USDC);
        vm.prank(alice);
        vm.expectRevert(Vault.ManagerShareTooLow.selector);
        vault.requestDeposit(19_001 * USDC); // manager would hold under 5%
        deposit(alice, 19_000 * USDC);
    }

    function test_deposit_revertsAboveBucketCap() public {
        deposit(manager, 100_000 * USDC);
        vm.prank(alice);
        vm.expectRevert(Vault.CapExceeded.selector);
        vault.requestDeposit(900_001 * USDC);
    }

    function test_deposit_pausedByGuardian_withdrawalsStillWork() public {
        seed();
        vm.prank(guardian);
        vault.pauseDeposits(true);
        vm.prank(alice);
        vm.expectRevert(Vault.Paused.selector);
        vault.requestDeposit(1 * USDC);
        vm.prank(alice);
        vault.requestWithdraw(1_000 * USDC);
        doCutoff();
        vault.claimWithdraw(alice);
        vm.prank(guardian);
        vm.expectRevert(Vault.NotAllowed.selector);
        vault.pauseDeposits(false);
    }

    function test_deposit_secondRequestInSameEpochAdds() public {
        deposit(manager, 10_000 * USDC);
        deposit(alice, 10_000 * USDC);
        deposit(alice, 5_000 * USDC);
        doCutoff();
        vault.claimDeposit(alice);
        assertEq(vault.balanceOf(alice), 15_000 * USDC);
    }

    // ── withdrawals ──

    function test_withdraw_paidInFullWhenCashAllows() public {
        seed();
        vm.prank(alice);
        vault.requestWithdraw(40_000 * USDC);
        assertEq(vault.balanceOf(alice), 50_000 * USDC, "queued shares are locked");
        doCutoff();
        uint256 before = usdc.balanceOf(alice);
        vault.claimWithdraw(alice);
        assertEq(usdc.balanceOf(alice) - before, 40_000 * USDC);
        assertEq(vault.totalSupply(), 60_000 * USDC);
        assertEq(vault.claimable(), 0);
    }

    function test_withdraw_proRataWhenCashIsShort() public {
        seed();
        vm.prank(admin);
        desk.setParams(1_000, 100, 20_000, 30_000, 1_000_000 * USDC, 200);
        for (uint256 i; i < 4; ++i) {
            vm.prank(trader);
            desk.open(10_000 * USDC, 30_000, 14 days, 0); // four tickets finance 80,000; idle 20,000
        }
        vm.prank(admin);
        vault.setDepositor(bob, true);

        vm.prank(alice);
        vault.requestWithdraw(30_000 * USDC);
        vm.prank(manager);
        vault.requestWithdraw(5_000 * USDC); // keeps 5,000 of 100,000: exactly the minimum
        doCutoff();

        // 35,000 shares asked; 20,000 idle. Price is a touch above 1 from accrued markup.
        uint256 price = vault.lastPrice();
        (,, uint256 wdShares, uint256 wdBurned, uint256 wdAssets) = vault.epochs(vault.epoch() - 1);
        assertEq(wdShares, 35_000 * USDC);
        assertLt(wdBurned, wdShares);
        assertApproxEqAbs(wdAssets, 20_000 * USDC, 2);
        assertEq(vault.idle(), 20_000 * USDC - wdAssets);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vault.claimWithdraw(alice);
        vault.claimWithdraw(manager);
        // Same proportion for both, and the unredeemed shares come back.
        assertApproxEqAbs(usdc.balanceOf(alice) - aliceBefore, wdAssets * 30_000 / 35_000, 1);
        assertApproxEqAbs(vault.balanceOf(alice), 60_000 * USDC + 30_000 * USDC - (wdBurned * 30_000 / 35_000), 2);
        assertGt(price, 1e18);
        assertEq(usdc.balanceOf(address(vault)), vaultBacked());
    }

    function test_withdraw_managerCannotGoBelowMinimum() public {
        seed();
        vm.prank(manager);
        vm.expectRevert(Vault.ManagerShareTooLow.selector);
        vault.requestWithdraw(5_001 * USDC);
    }

    function test_claims_areNoOpsBeforeCutoff() public {
        deposit(manager, 10_000 * USDC);
        vault.claimDeposit(manager);
        vault.claimWithdraw(manager);
        assertEq(vault.balanceOf(manager), 0);
        assertEq(vault.queuedDeposits(), 10_000 * USDC);
    }

    // ── cut-off and share price ──

    function test_cutoff_revertsBeforeItIsDue() public {
        vm.expectRevert(Vault.TooEarly.selector);
        vault.cutoff();
    }

    function test_cutoff_anyoneCanRunIt_andItAdvancesAWeek() public {
        uint256 first = vault.nextCutoff();
        vm.warp(first);
        vm.prank(keeper);
        vault.cutoff();
        assertEq(vault.nextCutoff(), first + 7 days);
        assertEq(vault.epoch(), 2);
    }

    function test_sharePrice_risesWithMarkup_andReserveTakesItsSlice() public {
        seed();
        uint256 id = openExample();
        skipFresh(14 days + 1);
        desk.settle(id);
        uint256 markup = 8_438_356;
        assertEq(vault.reserve(), markup / 10, "10% of markup to the reserve");
        doCutoff();
        // NAV = 100,000 + 90% of markup; reserve is outside the share price.
        assertEq(vault.lastNav(), 100_000 * USDC + markup - markup / 10);
        assertGt(vault.lastPrice(), 1e18);
    }

    function test_sharePrice_marksUnrealisedLossAtCutoff() public {
        seed();
        openExample();
        setPrice(36_000); // coin worth 1,800 against 2,000 financed
        doCutoff();
        assertEq(vault.lastNav(), 98_000 * USDC + 1_800 * USDC);
        assertLt(vault.lastPrice(), 1e18);
    }

    function test_sharePrice_reserveAbsorbsVisibleShortfall() public {
        seed();
        // Build a reserve from a profitable ticket first.
        vm.prank(admin);
        desk.setParams(1_000, 100, 20_000, 30_000, 1_000_000 * USDC, 200);
        vm.prank(trader);
        uint256 big = desk.open(30_000 * USDC, 30_000, 14 days, 0);
        skipFresh(14 days + 1);
        desk.settle(big);
        uint256 reserve = vault.reserve();
        assertGt(reserve, 20 * USDC);

        uint256 id = openExample();
        setPrice(59_500); // coin worth 2,975 against a settlement of about 2,000: no shortfall
        uint256 navNoLoss = vault.navNow();
        setPrice(39_800); // coin worth 1,990: about 10.6 short of settlement, inside the reserve
        assertApproxEqAbs(vault.navNow(), navNoLoss, 1, "reserve fills the gap in the share price");
        id;
    }

    function test_sharePrice_ignoresDonations() public {
        seed();
        usdc.mint(address(vault), 50_000 * USDC);
        assertEq(vault.navNow(), 100_000 * USDC);
    }

    function test_cutoff_emptyBucketRestartsAtPriceOne() public {
        seed();
        vm.prank(admin);
        desk.setParams(1_000, 100, 20_000, 30_000, 1_000_000 * USDC, 200);
        // Put everything allowed to work, then lose it all.
        vm.prank(admin);
        vault.setParams(1_000_000 * USDC, 9_500, 1_000, 500, 0);
        vm.prank(alice);
        vault.requestWithdraw(90_000 * USDC);
        vm.prank(manager);
        vault.requestWithdraw(10_000 * USDC);
        doCutoff(); // everyone leaves; supply is zero, nav zero
        vault.claimWithdraw(alice);
        vault.claimWithdraw(manager);
        assertEq(vault.totalSupply(), 0);
        deposit(manager, 1_000 * USDC);
        doCutoff();
        vault.claimDeposit(manager);
        assertEq(vault.balanceOf(manager), 1_000 * USDC, "an empty bucket restarts at a price of one");
    }

    function test_cutoff_revertsWhenFeedIsStaleAndTicketsAreLive() public {
        seed();
        openExample();
        vm.warp(vault.nextCutoff());
        vm.expectRevert(Oracle.StalePrice.selector);
        vault.cutoff();
    }

    // ── shares ──

    function test_shares_cannotBeTransferredOrApproved() public {
        seed();
        vm.startPrank(alice);
        vm.expectRevert(Vault.SharesNotTransferable.selector);
        vault.transfer(bob, 1);
        vm.expectRevert(Vault.SharesNotTransferable.selector);
        vault.approve(bob, 1);
        vm.expectRevert(Vault.SharesNotTransferable.selector);
        vault.transferFrom(alice, bob, 1);
    }

    // ── access ──

    function test_onlyDeskCanMoveVaultMoney() public {
        vm.expectRevert(Vault.NotDesk.selector);
        vault.lend(1);
        vm.expectRevert(Vault.NotDesk.selector);
        vault.repay(1, 1);
        vm.expectRevert(Vault.NotDesk.selector);
        vault.writeOff(1);
    }

    function test_deskCanBeSetOnlyOnce() public {
        vm.prank(admin);
        vm.expectRevert(Vault.AlreadySet.selector);
        vault.setDesk(address(1));
    }

    function test_admin_cannotExceedHardLimits() public {
        vm.startPrank(admin);
        vm.expectRevert(Vault.OutOfBounds.selector);
        vault.setParams(1, 9_501, 0, 0, 0);
        vm.expectRevert(Vault.OutOfBounds.selector);
        vault.setParams(1, 0, 5_001, 0, 0);
        vm.expectRevert(Vault.OutOfBounds.selector);
        vault.setParams(1, 0, 0, 2_001, 0);
        vm.expectRevert(Vault.OutOfBounds.selector);
        vault.setParams(1, 0, 0, 0, 2_001);
    }

    function test_admin_onlyOwner() public {
        vm.expectRevert();
        vault.setParams(1, 1, 1, 1, 1);
        vm.expectRevert();
        vault.setDepositor(alice, true);
    }

    // ── fuzz ──

    function testFuzz_depositWithdrawRoundTripNeverCreatesMoney(uint256 a, uint256 b, uint256 w) public {
        a = bound(a, 1 * USDC, 400_000 * USDC);
        b = bound(b, 1 * USDC, 400_000 * USDC);
        deposit(manager, 50_000 * USDC);
        deposit(alice, a);
        deposit(bob, b);
        doCutoff();
        vault.claimDeposit(alice);
        vault.claimDeposit(bob);
        w = bound(w, 1, vault.balanceOf(alice));
        vm.prank(alice);
        vault.requestWithdraw(w);
        doCutoff();
        uint256 before = usdc.balanceOf(alice);
        vault.claimWithdraw(alice);
        assertLe(usdc.balanceOf(alice) - before, w, "never more than was put in at a price of one");
        assertEq(usdc.balanceOf(address(vault)), vaultBacked());
    }
}

contract FundAndOracleTest is Base {
    function test_fund_splitsTreasuryShare_andTreasuryPulls() public {
        usdc.mint(address(this), 1_000 * USDC);
        usdc.approve(address(fund), 1_000 * USDC);
        fund.receiveShare(1_000 * USDC);
        assertEq(fund.treasuryAccrued(), 200 * USDC);
        assertEq(fund.available(), 800 * USDC);
        fund.claimTreasury();
        assertEq(usdc.balanceOf(treasury), 200 * USDC);
        assertEq(fund.available(), 800 * USDC);
    }

    function test_fund_onlyRegisteredVaultCanDraw_andNeverTreasuryMoney() public {
        usdc.mint(address(this), 1_000 * USDC);
        usdc.approve(address(fund), 1_000 * USDC);
        fund.receiveShare(1_000 * USDC);
        vm.expectRevert(BackstopFund.NotVault.selector);
        fund.cover(1);
        vm.prank(address(vault));
        uint256 paid = fund.cover(5_000 * USDC);
        assertEq(paid, 800 * USDC);
        assertEq(usdc.balanceOf(address(fund)), 200 * USDC);
    }

    function test_fund_adminOnly() public {
        vm.expectRevert();
        fund.setVault(address(this), true);
        vm.prank(admin);
        vm.expectRevert(BackstopFund.ZeroAddress.selector);
        fund.setTreasury(address(0));
    }

    function test_oracle_valueAndQuantity() public view {
        assertEq(oracle.value(5_000_000), 3_000 * USDC);
        assertEq(oracle.quantity(3_000 * USDC), 5_000_000);
    }

    function test_oracle_revertsWhenStaleOrBad() public {
        skip(1 hours + 1);
        vm.expectRevert(Oracle.StalePrice.selector);
        oracle.price();
        feed.set(0);
        vm.expectRevert(Oracle.BadPrice.selector);
        oracle.price();
    }

    function test_oracle_sequencerDownOrJustRestarted() public {
        MockFeed seq = new MockFeed(0, 1); // 1 = down
        Oracle o = new Oracle(IAggregatorV3(address(feed)), IAggregatorV3(address(seq)), 1 hours, 8);
        vm.expectRevert(Oracle.SequencerDown.selector);
        o.price();
        seq.set(0); // back up just now
        vm.expectRevert(Oracle.SequencerDown.selector);
        o.price();
        skipFresh(1 hours);
        assertEq(o.price(), PRICE0 * 1e8);
    }
}
