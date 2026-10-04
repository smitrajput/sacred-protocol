// SPDX-License-Identifier: MIT
// Vendored from Standard Reserve's verified source on Robinhood Chain (token 0x88ad8DdF1E3898412146a534538d418c6F8A9062,
// hook 0xF1eE073811B14359D850825E48d200483200eDcd), MIT licensed. Only names are changed.
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title AddressRegistry
/// @notice Periphery bindings for the Sacred protocol. The owner can
///         re-point each key until its one-way `lock()` freezes the binding.
///         Migration happens by re-pointing, not by changing code.
contract AddressRegistry is Ownable2Step {
    mapping(bytes32 key => address addr) private _addresses;
    mapping(bytes32 key => bool) public locked;

    /// @notice One-way switch opening buyback ticks and POL pairing to
    ///         anyone. Reserve purchases remain owner-only. Size, cooldown,
    ///         and slippage limits apply in both modes, so the switch changes
    ///         who may crank, not what a crank can do.
    bool public executionPermissionless;

    event AddressSet(bytes32 indexed key, address indexed addr);
    event KeyLocked(bytes32 indexed key, address finalAddr);
    event ExecutionOpened();

    error KeyIsLocked(bytes32 key);
    error KeyNotSet(bytes32 key);
    error KeyIsSet(bytes32 key);
    error AlreadyOpen();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Open buyback ticks and POL pairing to the public. Irreversible.
    ///         ExpansionVault reserve purchases remain owner-only.
    function openExecution() external onlyOwner {
        if (executionPermissionless) revert AlreadyOpen();
        executionPermissionless = true;
        emit ExecutionOpened();
    }

    /// @notice Point `key` at `addr`. Reverts if the key has been locked.
    function set(bytes32 key, address addr) external onlyOwner {
        if (locked[key]) revert KeyIsLocked(key);
        _addresses[key] = addr;
        emit AddressSet(key, addr);
    }

    /// @notice Permanently freeze `key` at its current nonzero address.
    ///         Refuses an unset key, since locking at address(0) would break
    ///         every consumer that reads it; use `lockDisabled` to disable an
    ///         optional key.
    function lock(bytes32 key) external onlyOwner {
        if (locked[key]) revert KeyIsLocked(key);
        if (_addresses[key] == address(0)) revert KeyNotSet(key);
        locked[key] = true;
        emit KeyLocked(key, _addresses[key]);
    }

    /// @notice Permanently freeze an optional key at address(0), disabling it
    ///         forever. Requires the key to be unset so an accidental
    ///         lock-before-set is impossible. Used, for example, to renounce
    ///         the guardian.
    function lockDisabled(bytes32 key) external onlyOwner {
        if (locked[key]) revert KeyIsLocked(key);
        if (_addresses[key] != address(0)) revert KeyIsSet(key);
        locked[key] = true;
        emit KeyLocked(key, address(0));
    }

    /// @notice Current address for `key`; address(0) when unset.
    function get(bytes32 key) external view returns (address) {
        return _addresses[key];
    }
}
