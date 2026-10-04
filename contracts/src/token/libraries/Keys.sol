// SPDX-License-Identifier: MIT
// Vendored from Standard Reserve's verified source on Robinhood Chain (token 0x88ad8DdF1E3898412146a534538d418c6F8A9062,
// hook 0xF1eE073811B14359D850825E48d200483200eDcd), MIT licensed. Names are changed and
// BACKSTOP_FUND is added.
pragma solidity 0.8.26;

/// @notice Registry keys for periphery bindings.
/// @dev Core monetary bindings (SacredTokenDummy, CentralBank, CharterNFT) are
///      constructor immutables and do not pass through the registry.
library Keys {
    bytes32 internal constant GENESIS_MINTER = "GENESIS_MINTER";
    bytes32 internal constant GUARDIAN = "GUARDIAN";
    /// @dev Keeper allowed to run the two swap cranks (`pairPol`,
    ///      `buybackTick`) before execution opens to everyone. Gates nothing
    ///      else; zero disables it.
    bytes32 internal constant EXECUTOR = "EXECUTOR";
    bytes32 internal constant CHARTER_AUCTION = "CHARTER_AUCTION";
    bytes32 internal constant LICENSE_AUCTION = "LICENSE_AUCTION";
    bytes32 internal constant FEE_SPLITTER = "FEE_SPLITTER";
    bytes32 internal constant NET_FLOW_SOURCE = "NET_FLOW_SOURCE";
    /// @dev The only hook the token lets authorize PoolManager transfers.
    ///      Set and locked at deploy; changing the hook means a new pool.
    bytes32 internal constant TAX_HOOK = "TAX_HOOK";
    bytes32 internal constant EXPANSION_VAULT = "EXPANSION_VAULT";
    bytes32 internal constant CONTRACTION_VAULT = "CONTRACTION_VAULT";
    bytes32 internal constant POL_MANAGER = "POL_MANAGER";
    /// @dev The fund whose shortfall sales of staked SCR pay no pool fee.
    bytes32 internal constant BACKSTOP_FUND = "BACKSTOP_FUND";
}
