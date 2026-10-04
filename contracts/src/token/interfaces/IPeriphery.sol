// SPDX-License-Identifier: MIT
// Vendored from Standard Reserve's verified source on Robinhood Chain (token 0x88ad8DdF1E3898412146a534538d418c6F8A9062,
// hook 0xF1eE073811B14359D850825E48d200483200eDcd), MIT licensed. Only names are changed.
pragma solidity 0.8.26;

/// @notice Source of the per-epoch net-flow signal, implemented by the TaxHook.
/// @dev Swaps are attributed to epochs by timestamp against the wall-clock
///      boundary the CentralBank sets. The source closes its running window
///      at the first swap on or after the boundary, or at the pull if no swap
///      came first, and returns the closed window's ETH net flow (buys minus
///      sells, in wei, gross of tax). `openEpochWindow` sets the first
///      boundary when emissions start; every pull sets the next. A boundary
///      already in the past when set is a gap epoch: it reads zero, and the
///      swaps of that period count toward the epoch that is live when the
///      late crank runs.
interface INetFlowSource {
    function openEpochWindow(uint256 firstBoundary) external;
    function takeEpochNetFlow(uint256 nextBoundary) external returns (int256 netFlowWei);
}

/// @notice Tax custody on the hook. Taxes are held in the hook and pushed to
///         the FeeSplitter by this permissionless crank, so a splitter fault
///         cannot block swaps. Forwards the taxes accrued up to the last
///         closed epoch boundary, so each epoch's revenue is routed on that
///         epoch's own sign; taxes of the open window wait for its boundary.
interface ITaxSource {
    function forwardTaxes() external;
}

/// @notice Launch-window clock on the TaxHook: true while the launch tax
///         schedule still governs (not retired by `setTaxes` and not yet
///         decayed to the floor). The token's launch holding cap follows it.
interface ILaunchSchedule {
    function launchScheduleActive() external view returns (bool);
}

/// @notice Epoch hook on the FeeSplitter: route the ETH accumulated this epoch.
interface IEpochFeeSplitter {
    /// @param expansion True when the settled epoch's raw net flow was positive
    ///        (70% leg goes to the ExpansionVault), false otherwise (ContractionVault).
    function settleEpoch(bool expansion) external;
}
