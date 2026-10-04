// SPDX-License-Identifier: MIT
// Vendored from Standard Reserve's verified source on Robinhood Chain (token 0x88ad8DdF1E3898412146a534538d418c6F8A9062,
// hook 0xF1eE073811B14359D850825E48d200483200eDcd), MIT licensed. Only names are changed.
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TransientSlot} from "@openzeppelin/contracts/utils/TransientSlot.sol";
import {AddressRegistry} from "./AddressRegistry.sol";
import {Keys} from "./libraries/Keys.sol";
import {ILaunchSchedule} from "./interfaces/IPeriphery.sol";

/// @title SCR
/// @notice The liquid ERC-20 currency of the protocol.
///
///         Supply model:
///         - Hard cap of 1,000,000,000. Every public burn (buybacks, POL fee
///           disposal, voluntary burns) permanently lowers the mintable
///           ceiling, so `maxSupply()` only decreases.
///         - Value that leaves the CentralBank ledger without being minted
///           (license payments, the non-recycled half of resolution and
///           revocation fees) lowers the ceiling the same way via `retire`.
///         - The CentralBank deposit path is the exception: it converts
///           tokens into ledger credit that withdrawals later re-mint. Those
///           burns go through `convertFrom` and do not consume cap headroom;
///           otherwise each deposit/withdraw cycle would shrink the ceiling
///           until withdrawals failed with credit stuck in the ledger.
///         - Only the CentralBank mints: once for genesis liquidity, then for
///           withdrawal and revocation proceeds.
///
///         Venue gate: the canonical pool carries the taxes, the net-flow
///         signal, and protocol liquidity, so the token steers trading there.
///         - Every Uniswap v4 pool settles through one PoolManager, so a
///           transfer to or from it is allowed only up to the amount the
///           canonical TaxHook authorized in this transaction. The hook
///           reports the SCR leg of each canonical swap and liquidity
///           change, and the budget is consumed as the router settles. A pool
///           without the hook gets no budget and its settlements revert.
///           Budgets are transient and cannot outlive the transaction. The
///           check is on from deploy; the bank owner can switch it off and
///           back on.
///         - Venues outside v4 (v2 pairs, v3 pools) are separate contracts
///           and are blocked by address at the bank owner's discretion. Only
///           transfers into a blocked venue revert, so it can neither be sold
///           into nor supplied, but positions can still be withdrawn.
///
///         Launch holding cap: while the hook's launch tax schedule is live,
///         no wallet may buy its way above `LAUNCH_HOLDING_CAP`. The check
///         runs on tokens leaving the PoolManager, so it covers direct and
///         routed buys; wallet transfers, mints, and the protocol's own
///         contracts are exempt. It lifts when the schedule ends, and the
///         bank owner can switch it off early without touching the taxes.
contract SacredTokenDummy is ERC20Burnable {
    using TransientSlot for bytes32;
    using TransientSlot for TransientSlot.Uint256Slot;

    /// @notice The ceiling at genesis. The live ceiling is `maxSupply()`,
    ///         which only decreases.
    uint256 public constant HARD_CAP = 1_000_000_000e18;
    /// @notice Most a wallet may hold after a pool buy while the launch tax
    ///         schedule is live: 1.2% of the genesis liquidity.
    uint256 public constant LAUNCH_HOLDING_CAP = 1_200_000e18;

    /// @notice The only address allowed to mint.
    address public immutable centralBank;
    /// @notice Resolves the canonical hook (`Keys.TAX_HOOK`), the only caller
    ///         that may authorize PoolManager transfers.
    AddressRegistry public immutable registry;
    /// @notice The v4 singleton every v4 pool settles through.
    address public immutable poolManager;

    // keccak256("standard.poolManager.inbound") and ".outbound", minus one.
    bytes32 private constant INBOUND_BUDGET_SLOT =
        0x7f2e0a3e5fbd8a7f0f0d3b4d3ad8bd7fb6b1f4f2f5b7c0a1e2c1c9f7d1a4b3c1;
    bytes32 private constant OUTBOUND_BUDGET_SLOT =
        0x3a9c1f4b7e2d5c8a1f6b9e0d2c4a7f8b3e6d1c9a5f2b8e4d7c0a3f6b9e1d4c2a;

    /// @notice Supply permanently retired through the public burn paths.
    uint256 public burnedForever;
    /// @notice Unminted ledger value permanently retired by the CentralBank:
    ///         license payments and the non-recycled half of resolution and
    ///         revocation fees.
    uint256 public ledgerRetired;

    /// @notice Addresses SCR may not move into (external DEX venues and
    ///         bypass routers). Outbound stays open so existing positions can
    ///         be withdrawn.
    mapping(address venue => bool) public blockedVenue;

    /// @notice Whether the PoolManager budget check is active. On from
    ///         deploy; the bank owner can switch it off and on again if the
    ///         token ever needs to settle somewhere the hook cannot
    ///         authorize. Independent of the blocklist.
    bool public poolManagerGateEnabled = true;

    /// @notice Whether the launch holding cap is active. On from deploy and
    ///         binding only while the hook's launch schedule is live. The
    ///         bank owner can switch it off, for example if a router holds
    ///         buys transiently, without retiring the tax schedule.
    bool public launchHoldingCapEnabled = true;

    event BurnedForever(address indexed from, uint256 amount, uint256 newMaxSupply);
    event LedgerRetired(uint256 amount, uint256 newMaxSupply);
    event PoolManagerTransferAuthorized(bool inbound, uint256 amount);
    event VenueBlocked(address indexed venue, bool blocked);
    event PoolManagerGateSet(bool enabled);
    event LaunchHoldingCapSet(bool enabled);

    error NotCentralBank();
    error NotCanonicalHook();
    error NotBankOwner();
    error HardCapExceeded();
    error ZeroPoolManager();
    /// @notice A transfer with the PoolManager exceeded what the canonical
    ///         hook authorized in this transaction. Route the trade or
    ///         liquidity change through the canonical pool.
    error UnauthorizedPoolManagerTransfer(bool inbound, uint256 amount, uint256 authorized);
    error BlockedVenue(address venue);
    error InvalidVenue();
    /// @notice A pool buy would leave `wallet` above the launch holding cap
    ///         while the launch tax schedule is live.
    error LaunchHoldingCapExceeded(address wallet, uint256 balanceAfter);

    constructor(address centralBank_, AddressRegistry registry_, address poolManager_)
        ERC20("SacredTokenDummy", "SRD")
    {
        if (poolManager_ == address(0)) revert ZeroPoolManager();
        centralBank = centralBank_;
        registry = registry_;
        poolManager = poolManager_;
    }

    /// @notice The live mintable ceiling: the genesis cap minus everything
    ///         permanently burned or retired. Non-increasing.
    function maxSupply() public view returns (uint256) {
        return HARD_CAP - burnedForever - ledgerRetired;
    }

    /// @notice Mint `amount` to `to`. CentralBank only; reverts above the
    ///         live ceiling.
    function mint(address to, uint256 amount) external {
        if (msg.sender != centralBank) revert NotCentralBank();
        if (totalSupply() + amount > maxSupply()) revert HardCapExceeded();
        _mint(to, amount);
    }

    /// @notice Burn the caller's tokens and lower the ceiling permanently.
    function burn(uint256 amount) public override {
        _retire(msg.sender, amount);
        super.burn(amount);
    }

    /// @notice Burn from `account` using allowance and lower the ceiling
    ///         permanently.
    function burnFrom(address account, uint256 amount) public override {
        _retire(account, amount);
        super.burnFrom(account, amount);
    }

    /// @notice Deposit conversion: burn `from`'s tokens without lowering the
    ///         ceiling, since the value re-enters the ledger and is re-minted
    ///         on withdrawal. CentralBank only; spends allowance like
    ///         `burnFrom`.
    function convertFrom(address from, uint256 amount) external {
        if (msg.sender != centralBank) revert NotCentralBank();
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
    }

    /// @notice Retire `amount` of ledger value that will never be minted,
    ///         lowering the ceiling as a token burn would. No balance moves;
    ///         the value already left the ledger. CentralBank only.
    function retire(uint256 amount) external {
        if (msg.sender != centralBank) revert NotCentralBank();
        ledgerRetired += amount;
        emit LedgerRetired(amount, maxSupply());
    }

    // ------------------------------------------------------------------
    // Venue gate
    // ------------------------------------------------------------------

    /// @notice Allow `amount` more SCR to move into (`inbound`) or out
    ///         of the PoolManager during this transaction. Canonical hook
    ///         only; called from its swap and liquidity callbacks, which run
    ///         before the router settles.
    function authorizePoolManagerTransfer(bool inbound, uint256 amount) external {
        if (msg.sender != registry.get(Keys.TAX_HOOK)) revert NotCanonicalHook();
        TransientSlot.Uint256Slot slot = _budgetSlot(inbound);
        slot.tstore(slot.tload() + amount);
        emit PoolManagerTransferAuthorized(inbound, amount);
    }

    /// @notice SCR the PoolManager may still receive (`inbound`) or send
    ///         in this transaction.
    function poolManagerTransferBudget(bool inbound) external view returns (uint256) {
        return _budgetSlot(inbound).tload();
    }

    /// @notice Block or unblock an external venue. Bank owner only. The
    ///         PoolManager, the bank, and the zero address cannot be blocked
    ///         because that would break settlement, deposits, or burns.
    function setBlockedVenue(address venue, bool blocked) external {
        if (msg.sender != Ownable(centralBank).owner()) revert NotBankOwner();
        if (venue == address(0) || venue == poolManager || venue == centralBank) {
            revert InvalidVenue();
        }
        blockedVenue[venue] = blocked;
        emit VenueBlocked(venue, blocked);
    }

    /// @notice Switch the PoolManager budget check off or on. Bank owner
    ///         only. When off, the token settles through any v4 pool like a
    ///         plain ERC-20; hook authorizations are still recorded but
    ///         unused.
    function setPoolManagerGate(bool enabled) external {
        if (msg.sender != Ownable(centralBank).owner()) revert NotBankOwner();
        poolManagerGateEnabled = enabled;
        emit PoolManagerGateSet(enabled);
    }

    /// @notice Switch the launch holding cap off or on. Bank owner only.
    ///         Has no effect once the launch schedule has ended.
    function setLaunchHoldingCap(bool enabled) external {
        if (msg.sender != Ownable(centralBank).owner()) revert NotBankOwner();
        launchHoldingCapEnabled = enabled;
        emit LaunchHoldingCapSet(enabled);
    }

    /// @notice True while pool buys are capped: the switch is on and the
    ///         hook's launch tax schedule is live.
    function launchHoldingCapActive() public view returns (bool) {
        if (!launchHoldingCapEnabled) return false;
        address hook = registry.get(Keys.TAX_HOOK);
        return hook != address(0) && ILaunchSchedule(hook).launchScheduleActive();
    }

    function _update(address from, address to, uint256 value) internal override {
        // Inbound only: a blocked venue can neither be sold into nor
        // supplied, but LPs and holders there can still withdraw.
        if (blockedVenue[to]) revert BlockedVenue(to);
        if (from == poolManager) _checkHoldingCap(to, value);
        if (poolManagerGateEnabled) {
            if (to == poolManager) _consumeBudget(true, value);
            else if (from == poolManager) _consumeBudget(false, value);
        }
        super._update(from, to, value);
    }

    /// @dev Tokens leaving the PoolManager are a buy, a protocol crank's swap
    ///      leg, or an LP withdrawal. Only buys are capped: the protocol's
    ///      own contracts and the hook are exempt. The schedule check runs
    ///      last because it is the only external read.
    function _checkHoldingCap(address to, uint256 value) private view {
        if (!launchHoldingCapEnabled) return;
        uint256 balanceAfter = balanceOf(to) + value;
        if (balanceAfter <= LAUNCH_HOLDING_CAP) return;
        if (_holdingCapExempt(to)) return;
        if (!launchHoldingCapActive()) return;
        revert LaunchHoldingCapExceeded(to, balanceAfter);
    }

    function _holdingCapExempt(address account) private view returns (bool) {
        if (account == centralBank) return true;
        return account == registry.get(Keys.TAX_HOOK) || account == registry.get(Keys.POL_MANAGER)
            || account == registry.get(Keys.CONTRACTION_VAULT)
            || account == registry.get(Keys.EXPANSION_VAULT);
    }

    function _consumeBudget(bool inbound, uint256 value) private {
        TransientSlot.Uint256Slot slot = _budgetSlot(inbound);
        uint256 budget = slot.tload();
        if (value > budget) revert UnauthorizedPoolManagerTransfer(inbound, value, budget);
        slot.tstore(budget - value);
    }

    function _budgetSlot(bool inbound) private pure returns (TransientSlot.Uint256Slot) {
        return (inbound ? INBOUND_BUDGET_SLOT : OUTBOUND_BUDGET_SLOT).asUint256();
    }

    function _retire(address from, uint256 amount) private {
        burnedForever += amount;
        emit BurnedForever(from, amount, maxSupply());
    }
}
