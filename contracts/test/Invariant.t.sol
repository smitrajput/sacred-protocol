// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {Test, console} from "forge-std/Test.sol";
import {Desk} from "../src/Desk.sol";
import {Vault} from "../src/Vault.sol";
import {BackstopFund} from "../src/BackstopFund.sol";
import {MockERC20, MockFeed, MockRouter} from "../src/mocks/Mocks.sol";

/// Drives the whole system with random depositors, traders, prices and time.
contract Handler is Test {
    uint256 internal constant USDC = 1e6;

    Vault internal vault;
    Desk internal desk;
    MockERC20 internal usdc;
    MockERC20 internal coin;
    MockFeed internal feed;
    MockRouter internal router;
    address[] internal depositors;
    address[] internal traders;

    uint256 public price = 60_000;
    uint256[] public ids;
    // Ghosts
    mapping(uint256 => uint256) public lastBalance; // financed + markup - repaid, per ticket
    bool public balanceEverIncreased;
    bool public vaultOverpaid;
    bool public traderChargedAtSettlement;
    uint256 public opened;
    uint256 public ended;

    constructor(
        Vault vault_,
        Desk desk_,
        MockERC20 usdc_,
        MockERC20 coin_,
        MockFeed feed_,
        MockRouter router_,
        address[] memory depositors_,
        address[] memory traders_
    ) {
        vault = vault_;
        desk = desk_;
        usdc = usdc_;
        coin = coin_;
        feed = feed_;
        router = router_;
        depositors = depositors_;
        traders = traders_;
    }

    function _fresh() internal {
        feed.set(int256(price * 1e8));
        router.setPrice(price * USDC);
    }

    function _track(uint256 id) internal {
        Desk.Ticket memory t = desk.getTicket(id);
        uint256 bal = t.status == Desk.Status.Live ? t.financed + t.markup - t.repaid : 0;
        if (bal > lastBalance[id]) balanceEverIncreased = true;
        lastBalance[id] = bal;
    }

    function requestDeposit(uint256 who, uint256 assets) external {
        address u = depositors[who % depositors.length];
        assets = bound(assets, 1 * USDC, 50_000 * USDC);
        vm.prank(u);
        try vault.requestDeposit(assets) {} catch {}
    }

    function requestWithdraw(uint256 who, uint256 shares) external {
        address u = depositors[who % depositors.length];
        uint256 bal = vault.balanceOf(u);
        if (bal == 0) return;
        shares = bound(shares, 1, bal);
        vm.prank(u);
        try vault.requestWithdraw(shares) {} catch {}
    }

    function claim(uint256 who) external {
        address u = depositors[who % depositors.length];
        vault.claimDeposit(u);
        vault.claimWithdraw(u);
    }

    function cutoff() external {
        if (block.timestamp < vault.nextCutoff()) vm.warp(vault.nextCutoff());
        _fresh();
        vault.cutoff();
    }

    function open(uint256 who, uint256 dp, uint256 lev, bool longTerm) external {
        address u = traders[who % traders.length];
        dp = bound(dp, 10 * USDC, 5_000 * USDC);
        lev = bound(lev, 10_100, 30_000);
        _fresh();
        vm.prank(u);
        try desk.open(dp, lev, longTerm ? 14 days : 7 days, 0) returns (uint256 id) {
            ids.push(id);
            opened++;
            Desk.Ticket memory t = desk.getTicket(id);
            lastBalance[id] = t.financed + t.markup;
        } catch {}
    }

    function _pick(uint256 seed) internal view returns (uint256 id, Desk.Ticket memory t, bool ok) {
        if (ids.length == 0) return (0, t, false);
        id = ids[seed % ids.length];
        t = desk.getTicket(id);
        ok = t.status == Desk.Status.Live;
    }

    function _paidToVault(Desk.Ticket memory t, uint256 gain) internal {
        // Across its life a ticket pays the vault at most financed + markup.
        if (t.repaid + gain > t.financed + t.markup) vaultOverpaid = true;
    }

    function close(uint256 seed) external {
        (uint256 id, Desk.Ticket memory t, bool ok) = _pick(seed);
        if (!ok) return;
        _fresh();
        uint256 s = desk.settlementAmount(id);
        vm.prank(t.owner);
        try desk.close(id, 0) {
            ended++;
            _paidToVault(t, s);
            _track(id);
        } catch {}
    }

    function payOff(uint256 seed) external {
        (uint256 id, Desk.Ticket memory t, bool ok) = _pick(seed);
        if (!ok) return;
        _fresh();
        uint256 s = desk.settlementAmount(id);
        vm.prank(t.owner);
        try desk.payOff(id) {
            ended++;
            _paidToVault(t, s);
            _track(id);
        } catch {}
    }

    function partPay(uint256 seed, uint256 amount) external {
        (uint256 id, Desk.Ticket memory t, bool ok) = _pick(seed);
        if (!ok) return;
        uint256 s = desk.settlementAmount(id);
        if (s < 2) return;
        amount = bound(amount, 1, s - 1);
        vm.prank(t.owner);
        try desk.partPay(id, amount) {
            _track(id);
        } catch {}
    }

    function settle(uint256 seed) external {
        (uint256 id, Desk.Ticket memory t, bool ok) = _pick(seed);
        if (!ok) return;
        if (block.timestamp <= t.due) vm.warp(uint256(t.due) + 1);
        _fresh();
        uint256 traderBefore = usdc.balanceOf(t.owner);
        try desk.settle(id) {
            ended++;
            if (usdc.balanceOf(t.owner) < traderBefore) traderChargedAtSettlement = true;
            _track(id);
        } catch {}
    }

    function claimOwed(uint256 who) external {
        vm.prank(traders[who % traders.length]);
        desk.claimOwed();
    }

    function movePrice(uint256 p) external {
        // Up to 30% down or 40% up in one step, floored well above zero.
        price = bound(p, price * 70 / 100, price * 140 / 100);
        if (price < 1_000) price = 1_000;
        if (price > 1_000_000) price = 1_000_000;
        _fresh();
    }

    function warp(uint256 secs) external {
        skip(bound(secs, 1 hours, 3 days));
    }

    function idsLength() external view returns (uint256) {
        return ids.length;
    }
}

contract InvariantTest is Base {
    Handler internal handler;

    function setUp() public override {
        super.setUp();
        seed();
        address[] memory deps = new address[](3);
        deps[0] = manager;
        deps[1] = alice;
        deps[2] = bob;
        address[] memory trs = new address[](2);
        trs[0] = trader;
        trs[1] = makeAddr("trader2");
        usdc.mint(trs[1], 10_000_000 * USDC);
        vm.prank(trs[1]);
        usdc.approve(address(desk), type(uint256).max);
        vm.prank(admin);
        desk.setTrader(trs[1], true);

        handler = new Handler(vault, desk, usdc, coin, feed, router, deps, trs);
        targetContract(address(handler));
    }

    /// Every USDC in the vault is counted once, and nothing counted is missing.
    function invariant_vaultIsFullyBacked() public view {
        assertEq(usdc.balanceOf(address(vault)), vaultBacked());
    }

    /// The vault's record of principal out equals what live tickets still owe in principal.
    function invariant_lentMatchesLiveTickets() public view {
        uint256 sum;
        uint256 n = desk.liveCount();
        for (uint256 i; i < n; ++i) {
            Desk.Ticket memory t = desk.getTicket(desk.liveIds(i));
            sum += t.financed - t.principalRepaid;
        }
        assertEq(vault.lent(), sum);
    }

    /// The desk holds exactly the pledged coins of live tickets and no stray USDC.
    function invariant_deskHoldsOnlyPledgesAndOwedSurpluses() public view {
        uint256 qty;
        uint256 n = desk.liveCount();
        for (uint256 i; i < n; ++i) {
            qty += desk.getTicket(desk.liveIds(i)).qty;
        }
        assertEq(coin.balanceOf(address(desk)), qty);
        assertEq(usdc.balanceOf(address(desk)), desk.totalOwed());
    }

    /// Live tickets and only live tickets are in the live list.
    function invariant_liveListIsExact() public view {
        uint256 live;
        uint256 n = handler.idsLength();
        for (uint256 i; i < n; ++i) {
            if (desk.getTicket(handler.ids(i)).status == Desk.Status.Live) live++;
        }
        assertEq(desk.liveCount(), live);
        assertEq(handler.opened() - handler.ended(), live);
    }

    function invariant_aBalanceNeverIncreases() public view {
        assertFalse(handler.balanceEverIncreased());
    }

    function invariant_vaultNeverReceivesMoreThanTheBalance() public view {
        assertFalse(handler.vaultOverpaid());
    }

    function invariant_settlementNeverChargesTheTrader() public view {
        assertFalse(handler.traderChargedAtSettlement());
    }

    /// Shares the vault holds are exactly those waiting in a queue or waiting to be claimed.
    function invariant_sharesOnlyMoveThroughTheVault() public view {
        assertEq(
            vault.totalSupply(),
            vault.balanceOf(manager) + vault.balanceOf(alice) + vault.balanceOf(bob) + vault.balanceOf(address(vault))
        );
    }

    function afterInvariant() public view {
        console.log("opened/ended/epoch", handler.opened(), handler.ended(), vault.epoch());
    }

    /// The fund never dips into the treasury's accrued share.
    function invariant_fundKeepsTreasuryMoney() public view {
        assertGe(usdc.balanceOf(address(fund)), fund.treasuryAccrued());
    }
}
