// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title TicketMath
/// @notice Pure arithmetic for a murabaha ticket. Kept in one place so it can be
///         fuzzed and symbolically checked on its own. All amounts are USDC units.
library TicketMath {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant YEAR = 365 days;
    /// The least markup the vault earns, in time. Stops free intraday financing.
    uint256 internal constant MIN_EARNED = 1 days;

    /// What the vault pays for the coin: down payment times leverage.
    function cost(uint256 downPayment, uint256 leverageBps) internal pure returns (uint256) {
        return downPayment * leverageBps / BPS;
    }

    /// The fixed markup for the whole term. Never changes after opening.
    function markup(uint256 financed, uint256 rateBps, uint256 term) internal pure returns (uint256) {
        return financed * rateBps * term / (BPS * YEAR);
    }

    /// Markup earned so far. The rest is waived on early settlement.
    /// Rises linearly from MIN_EARNED worth at opening to the full markup at the due date.
    function earned(uint256 markup_, uint256 opened, uint256 due, uint256 nowTs) internal pure returns (uint256) {
        uint256 term = due - opened;
        uint256 elapsed = nowTs > opened ? nowTs - opened : 0;
        if (elapsed < MIN_EARNED) elapsed = MIN_EARNED;
        if (elapsed > term) elapsed = term;
        return markup_ * elapsed / term;
    }

    /// What closes the ticket today: financed amount plus earned markup, minus part payments.
    function settlement(uint256 financed, uint256 markup_, uint256 repaid, uint256 opened, uint256 due, uint256 nowTs)
        internal
        pure
        returns (uint256)
    {
        return financed + earned(markup_, opened, due, nowTs) - repaid;
    }

    /// Split a payment to the vault into principal first, then markup.
    function split(uint256 amount, uint256 principalLeft) internal pure returns (uint256 principal, uint256 markup_) {
        principal = amount < principalLeft ? amount : principalLeft;
        markup_ = amount - principal;
    }

    /// The share of profit donated to the backstop fund. Zero when there is no profit.
    function profitShare(uint256 takesOut, uint256 paidIn, uint256 shareBps) internal pure returns (uint256) {
        if (takesOut <= paidIn) return 0;
        return (takesOut - paidIn) * shareBps / BPS;
    }
}
