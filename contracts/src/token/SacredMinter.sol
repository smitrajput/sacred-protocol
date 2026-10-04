// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {SacredTokenDummy} from "./SacredTokenDummy.sol";

/// @title SacredMinter
/// @notice The only address that can mint SCR (the token's `centralBank`). It mints
///         twice and never at anyone's discretion: once at genesis, for every
///         allocation except reserve sales, and afterwards only to the reserve sale,
///         up to the reserve-sale allocation. Its owner (the time-lock) is also the
///         address the token accepts for its venue-gate and launch-cap switches.
contract SacredMinter is Ownable2Step {
    error AlreadySet();
    error NotBound();
    error NotSale();
    error ZeroAddress();
    error AllocationExceeded();

    event Bound(address indexed token);
    event Genesis(address indexed to, uint256 amount);
    event SaleSet(address indexed sale);
    event MintedForSale(address indexed to, uint256 amount);

    /// 10% of the 1 billion supply is set aside for reserve sales.
    uint256 public constant SALE_ALLOCATION = 100_000_000e18;
    /// Everything else, minted once at genesis.
    uint256 public constant GENESIS_SUPPLY = 900_000_000e18;

    SacredTokenDummy public token;
    address public sale;
    bool public genesisDone;
    uint256 public mintedForSale;

    constructor(address owner_) Ownable(owner_) {}

    /// The token takes this contract's address in its constructor, so it is bound after.
    function bind(SacredTokenDummy token_) external onlyOwner {
        if (address(token) != address(0)) revert AlreadySet();
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
        emit Bound(address(token_));
    }

    /// Mint the genesis supply to the distributor. Once.
    function genesis(address to) external onlyOwner {
        if (address(token) == address(0)) revert NotBound();
        if (genesisDone) revert AlreadySet();
        if (to == address(0)) revert ZeroAddress();
        genesisDone = true;
        token.mint(to, GENESIS_SUPPLY);
        emit Genesis(to, GENESIS_SUPPLY);
    }

    function setSale(address sale_) external onlyOwner {
        sale = sale_;
        emit SaleSet(sale_);
    }

    /// Mint sold SCR to the buyer. Only the reserve sale, inside its allocation.
    function mintForSale(address to, uint256 amount) external {
        if (msg.sender != sale) revert NotSale();
        if (mintedForSale + amount > SALE_ALLOCATION) revert AllocationExceeded();
        mintedForSale += amount;
        token.mint(to, amount);
        emit MintedForSale(to, amount);
    }
}
