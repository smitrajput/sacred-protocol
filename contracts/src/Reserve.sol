// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Vault} from "./Vault.sol";

/// @title Reserve
/// @notice The liquidity reserve: a standalone pool of one stablecoin. It is filled by
///         reserve sales and pool fees, which arrive as plain transfers. Its only way
///         out is a deposit into a bucket that is short of cash for its withdrawal
///         queue, made as an ordinary depositor. It earns and loses like any depositor
///         and withdraws when the pressure clears.
/// @dev    The operator can only move cash into a listed bucket, and only up to that
///         bucket's visible shortage, so it cannot take anything out of the protocol.
contract Reserve is Ownable2Step {
    using SafeERC20 for IERC20;

    error NotOperator();
    error NotListed();
    error WrongAsset();
    error NotShort();
    error AboveShortage();
    error OutOfBounds();
    error PositionOpen();
    error TooManyVaults();

    event VaultSet(address indexed vault, bool listed);
    event OperatorSet(address indexed operator);
    event TargetSet(uint256 targetBps);
    event Deposited(address indexed vault, uint256 assets);
    event WithdrawRequested(address indexed vault, uint256 shares);

    uint256 public constant MAX_TARGET_BPS = 5_000;
    uint256 public constant MAX_VAULTS = 16;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;

    IERC20 public immutable usdc;
    /// The keeper that moves cash in and out of buckets.
    address public operator;
    /// The reserve's target, as a share of the listed buckets' deposits.
    uint256 public targetBps = 1_000;
    Vault[] public vaults;
    mapping(address => bool) public isListed;

    constructor(IERC20 usdc_, address owner_) Ownable(owner_) {
        usdc = usdc_;
    }

    modifier onlyOperator() {
        if (msg.sender != operator && msg.sender != owner()) revert NotOperator();
        _;
    }

    // ───────────────────────── Buckets ─────────────────────────

    /// How much cash the bucket lacks for the withdrawals queued in its open epoch.
    function shortage(Vault vault) public view returns (uint256) {
        (,, uint256 wdShares,,) = vault.epochs(vault.epoch());
        uint256 need = wdShares * vault.lastPrice() / WAD;
        uint256 idle = vault.idle() + vault.queuedDeposits();
        return need > idle ? need - idle : 0;
    }

    /// Queue a deposit into a bucket that is short, up to its shortage.
    function deposit(Vault vault, uint256 assets) external onlyOperator {
        if (!isListed[address(vault)]) revert NotListed();
        uint256 gap = shortage(vault);
        if (gap == 0) revert NotShort();
        if (assets > gap) revert AboveShortage();
        usdc.forceApprove(address(vault), assets);
        vault.requestDeposit(assets);
        emit Deposited(address(vault), assets);
    }

    /// Queue shares for redemption once the pressure has cleared.
    function requestWithdraw(Vault vault, uint256 shares) external onlyOperator {
        if (!isListed[address(vault)]) revert NotListed();
        vault.claimDeposit(address(this));
        vault.requestWithdraw(shares);
        emit WithdrawRequested(address(vault), shares);
    }

    /// Collect processed deposits and withdrawals. Anyone may call.
    function claim(Vault vault) external {
        vault.claimDeposit(address(this));
        vault.claimWithdraw(address(this));
    }

    // ───────────────────────── Size ─────────────────────────

    /// The reserve's stake in a bucket at its last cut-off price: shares in hand,
    /// shares queued for withdrawal, and cash queued for deposit.
    function deployed(Vault vault) public view returns (uint256) {
        (uint256 queuedShares,) = vault.withdrawOf(address(this));
        (uint256 queuedAssets,) = vault.depositOf(address(this));
        return (vault.balanceOf(address(this)) + queuedShares) * vault.lastPrice() / WAD + queuedAssets;
    }

    /// Cash in hand plus everything placed in buckets.
    function totalAssets() public view returns (uint256 total) {
        total = usdc.balanceOf(address(this));
        for (uint256 i; i < vaults.length; ++i) {
            total += deployed(vaults[i]);
        }
    }

    function target() public view returns (uint256) {
        uint256 deposits;
        for (uint256 i; i < vaults.length; ++i) {
            deposits += vaults[i].lastNav();
        }
        return deposits * targetBps / BPS;
    }

    /// How far the reserve is below its target. Reserve sales are open while this
    /// is above zero.
    function shortfallToTarget() external view returns (uint256) {
        uint256 goal = target();
        uint256 have = totalAssets();
        return goal > have ? goal - have : 0;
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    // ───────────────────────── Admin (time-lock) ─────────────────────────

    /// List or unlist a bucket. A bucket can be unlisted only once the reserve has
    /// nothing left in it.
    function setVault(Vault vault, bool listed) external onlyOwner {
        if (listed == isListed[address(vault)]) return;
        if (listed) {
            if (address(vault.usdc()) != address(usdc)) revert WrongAsset();
            if (vaults.length == MAX_VAULTS) revert TooManyVaults();
            vaults.push(vault);
        } else {
            if (deployed(vault) != 0) revert PositionOpen();
            for (uint256 i; i < vaults.length; ++i) {
                if (vaults[i] == vault) {
                    vaults[i] = vaults[vaults.length - 1];
                    vaults.pop();
                    break;
                }
            }
        }
        isListed[address(vault)] = listed;
        emit VaultSet(address(vault), listed);
    }

    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
        emit OperatorSet(operator_);
    }

    function setTargetBps(uint256 targetBps_) external onlyOwner {
        if (targetBps_ > MAX_TARGET_BPS) revert OutOfBounds();
        targetBps = targetBps_;
        emit TargetSet(targetBps_);
    }
}
