// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ISwapRouter} from "../interfaces/External.sol";

/// Test token with open minting.
contract MockERC20 is ERC20 {
    uint8 internal immutable dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        dec = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// Chainlink-style feed with a settable answer.
contract MockFeed {
    uint8 public immutable decimals;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function set(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 ts) external {
        updatedAt = ts;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

/// Spot market stand-in: swaps USDC and coin at a settable price by minting and burning.
/// `slipBps` makes every swap execute that much worse than the price.
contract MockRouter {
    MockERC20 public immutable usdc;
    MockERC20 public immutable coin;
    uint256 public price; // USDC (6 decimals) per whole coin
    uint256 public slipBps;
    uint256 internal immutable coinUnit;

    constructor(MockERC20 usdc_, MockERC20 coin_, uint256 price_) {
        usdc = usdc_;
        coin = coin_;
        price = price_;
        coinUnit = 10 ** coin_.decimals();
    }

    function setPrice(uint256 price_) external {
        price = price_;
    }

    function setSlip(uint256 slipBps_) external {
        slipBps = slipBps_;
    }

    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata p) external payable returns (uint256 out) {
        if (p.tokenIn == address(usdc)) {
            out = p.amountIn * coinUnit / price;
        } else {
            out = p.amountIn * price / coinUnit;
        }
        out = out * (10_000 - slipBps) / 10_000;
        require(out >= p.amountOutMinimum, "Too little received");
        MockERC20(p.tokenIn).burn(msg.sender, p.amountIn);
        MockERC20(p.tokenOut).mint(p.recipient, out);
    }
}
