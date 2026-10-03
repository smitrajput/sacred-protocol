// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title BackstopFund
/// @notice Mutual shortfall fund, version one. Traders donate a share of realised
///         profit. A fifth goes to the treasury as a management fee and the rest
///         stays here to cover shortfalls after a bucket's own loss reserve.
///         There is no other way for USDC to leave. DES staking is a later version.
contract BackstopFund is Ownable2Step {
    using SafeERC20 for IERC20;

    error NotVault();
    error ZeroAddress();

    event Received(address indexed from, uint256 amount, uint256 toTreasury);
    event Covered(address indexed vault, uint256 asked, uint256 paid);
    event VaultSet(address indexed vault, bool allowed);
    event TreasurySet(address indexed treasury);

    uint256 public constant TREASURY_BPS = 2_000;
    uint256 internal constant BPS = 10_000;

    IERC20 public immutable usdc;
    address public treasury;
    uint256 public treasuryAccrued;
    mapping(address => bool) public isVault;

    constructor(IERC20 usdc_, address treasury_, address owner_) Ownable(owner_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        treasury = treasury_;
    }

    /// Pull a donation from the caller. Anyone may donate. The treasury's part is
    /// set aside and pulled later, so a blocked treasury can never block a ticket.
    function receiveShare(uint256 amount) external {
        uint256 toTreasury = amount * TREASURY_BPS / BPS;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        treasuryAccrued += toTreasury;
        emit Received(msg.sender, amount, toTreasury);
    }

    /// Send the treasury what it has accrued.
    function claimTreasury() external {
        uint256 amount = treasuryAccrued;
        treasuryAccrued = 0;
        usdc.safeTransfer(treasury, amount);
    }

    /// USDC available to cover shortfalls.
    function available() public view returns (uint256) {
        return usdc.balanceOf(address(this)) - treasuryAccrued;
    }

    /// Pay up to `amount` to the calling vault. Returns what was paid.
    function cover(uint256 amount) external returns (uint256 paid) {
        if (!isVault[msg.sender]) revert NotVault();
        uint256 balance = available();
        paid = amount < balance ? amount : balance;
        if (paid > 0) usdc.safeTransfer(msg.sender, paid);
        emit Covered(msg.sender, amount, paid);
    }

    function setVault(address vault, bool allowed) external onlyOwner {
        isVault[vault] = allowed;
        emit VaultSet(vault, allowed);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }
}
