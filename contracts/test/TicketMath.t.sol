// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {TicketMath} from "../src/TicketMath.sol";

/// Properties of the ticket arithmetic. `testFuzz_` functions run under forge;
/// `check_` functions are proved for all inputs by Halmos (symbolic execution).
contract TicketMathTest is Test {
    uint256 internal constant BPS = 10_000;

    // ── worked numbers from the design ──

    function test_designExample() public pure {
        assertEq(TicketMath.cost(1_000e6, 30_000), 3_000e6);
        assertEq(TicketMath.markup(2_000e6, 1_100, 14 days), 8_438_356);
        assertEq(TicketMath.earned(8_438_356, 0, 14 days, 5 days), 3_013_698);
        assertEq(TicketMath.profitShare(1_591_561_644, 1_000e6, 3_000), 177_468_493);
    }

    // ── fuzz ──

    function testFuzz_earnedIsBoundedAndMonotonic(uint256 m, uint256 term, uint256 a, uint256 b) public pure {
        m = bound(m, 0, 1e15);
        term = bound(term, 1 days, 30 days);
        a = bound(a, 0, 60 days);
        b = bound(b, a, 60 days);
        uint256 ea = TicketMath.earned(m, 1_000, 1_000 + term, 1_000 + a);
        uint256 eb = TicketMath.earned(m, 1_000, 1_000 + term, 1_000 + b);
        assertLe(ea, eb);
        assertLe(eb, m);
        if (b >= term) assertEq(eb, m);
    }

    function testFuzz_splitConservesAmount(uint256 amount, uint256 principalLeft) public pure {
        amount = bound(amount, 0, 1e30);
        principalLeft = bound(principalLeft, 0, 1e30);
        (uint256 p, uint256 mk) = TicketMath.split(amount, principalLeft);
        assertEq(p + mk, amount);
        assertLe(p, principalLeft);
    }

    function testFuzz_profitShareNeverExceedsProfit(uint256 out, uint256 paidIn) public pure {
        out = bound(out, 0, 1e30);
        paidIn = bound(paidIn, 0, 1e30);
        uint256 share = TicketMath.profitShare(out, paidIn, 3_000);
        if (out <= paidIn) assertEq(share, 0);
        else assertLe(share, out - paidIn);
    }

    // ── symbolic (Halmos): hold for every input in the stated ranges ──
    // The term is fixed to the two launch terms (7 and 14 days) so the solver divides by
    // a constant. Amount widths are narrowed where the property is nonlinear.

    function _term(bool longTerm) internal pure returns (uint256) {
        return longTerm ? 14 days : 7 days;
    }

    /// Earned markup never exceeds the fixed markup, at any time.
    function check_earnedNeverExceedsMarkup(uint64 m, uint32 opened, bool longTerm, uint40 nowTs) public pure {
        uint256 e = TicketMath.earned(m, opened, uint256(opened) + _term(longTerm), nowTs);
        assert(e <= m);
    }

    /// Earned markup never goes down as time passes, so a settlement amount never falls on its own.
    function check_earnedIsMonotonic(uint32 m, bool longTerm, uint24 e1, uint24 e2) public pure {
        vm.assume(e1 <= e2);
        uint256 due = _term(longTerm);
        assert(TicketMath.earned(m, 0, due, e1) <= TicketMath.earned(m, 0, due, e2));
    }

    /// At or after the due date the whole markup is earned: no waiver is left.
    function check_fullMarkupAtDue(uint64 m, uint32 opened, bool longTerm, uint40 nowTs) public pure {
        uint256 due = uint256(opened) + _term(longTerm);
        vm.assume(nowTs >= due);
        assert(TicketMath.earned(m, opened, due, nowTs) == m);
    }

    /// The settlement amount never exceeds the balance (financed + markup - repaid).
    function check_settlementNeverExceedsBalance(uint64 financed, uint64 m, uint64 repaid, bool longTerm, uint32 nowTs)
        public
        pure
    {
        uint256 due = _term(longTerm);
        vm.assume(uint256(repaid) <= uint256(financed) + TicketMath.earned(m, 0, due, nowTs));
        uint256 s = TicketMath.settlement(financed, m, repaid, 0, due, nowTs);
        assert(s <= uint256(financed) + m - repaid);
    }

    /// A payment is split into principal and markup with nothing lost or created.
    function check_splitConserves(uint128 amount, uint128 principalLeft) public pure {
        (uint256 p, uint256 mk) = TicketMath.split(amount, principalLeft);
        assert(p + mk == amount);
        assert(p <= principalLeft);
    }

    /// The profit share is zero without profit and never more than the profit.
    function check_profitShareBounded(uint128 out, uint128 paidIn) public pure {
        uint256 share = TicketMath.profitShare(out, paidIn, 3_000);
        if (out <= paidIn) assert(share == 0);
        else assert(share <= uint256(out) - paidIn);
    }

    /// The trader keeps at least 70% of any profit.
    function check_traderKeepsSeventyPercent(uint64 profit) public pure {
        uint256 share = TicketMath.profitShare(profit, 0, 3_000);
        assert((profit - share) * BPS >= uint256(profit) * 7_000);
    }

    /// Leverage above 1x never costs less than the down payment or more than three times it.
    function check_costAndFinanced(uint48 dp, uint16 levBps) public pure {
        vm.assume(levBps > BPS && levBps <= 30_000);
        uint256 c = TicketMath.cost(dp, levBps);
        assert(c >= dp);
        assert(c <= uint256(dp) * 3);
    }
}
