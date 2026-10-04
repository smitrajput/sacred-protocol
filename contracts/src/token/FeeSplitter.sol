// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Reserve} from "../Reserve.sol";

/// @title FeeSplitter
/// @notice Receives the pool fee from the hook and divides it: a fifth to the
///         treasury, the rest to the liquidity reserve until it reaches its target,
///         and anything beyond that to the backstop fund. Everything it holds is pool
///         fee, so the split needs no accounting and anyone may trigger it.
contract FeeSplitter {
    using SafeERC20 for IERC20;

    error ZeroAddress();

    event Split(uint256 toTreasury, uint256 toReserve, uint256 toFund);

    uint256 public constant TREASURY_BPS = 2_000;
    uint256 internal constant BPS = 10_000;

    IERC20 public immutable usdc;
    address public immutable treasury;
    Reserve public immutable reserve;
    address public immutable fund;

    constructor(IERC20 usdc_, address treasury_, Reserve reserve_, address fund_) {
        if (treasury_ == address(0) || address(reserve_) == address(0) || fund_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        treasury = treasury_;
        reserve = reserve_;
        fund = fund_;
    }

    /// Pay out everything held. A plain transfer to the fund counts in full towards
    /// its shortfall cover; the fund's own treasury cut applies only to profit shares.
    function split() external {
        uint256 amount = usdc.balanceOf(address(this));
        uint256 toTreasury = amount * TREASURY_BPS / BPS;
        uint256 rest = amount - toTreasury;
        uint256 gap = reserve.shortfallToTarget();
        uint256 toReserve = rest < gap ? rest : gap;
        uint256 toFund = rest - toReserve;

        if (toTreasury > 0) usdc.safeTransfer(treasury, toTreasury);
        if (toReserve > 0) usdc.safeTransfer(address(reserve), toReserve);
        if (toFund > 0) usdc.safeTransfer(fund, toFund);
        emit Split(toTreasury, toReserve, toFund);
    }
}
