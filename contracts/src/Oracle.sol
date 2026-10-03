// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAggregatorV3} from "./interfaces/External.sol";

/// @title Oracle
/// @notice Reads one Chainlink coin/USD feed and converts between coin and USDC.
///         Assumes 1 USDC = 1 USD. Reverts when the price is stale, non-positive,
///         or the L2 sequencer is down or has only just restarted.
contract Oracle {
    error StalePrice();
    error BadPrice();
    error SequencerDown();

    uint256 public constant SEQUENCER_GRACE = 1 hours;
    uint256 internal constant USDC_UNIT = 1e6;

    IAggregatorV3 public immutable feed;
    /// Zero on chains without a sequencer feed.
    IAggregatorV3 public immutable sequencerFeed;
    uint256 public immutable maxAge;
    uint256 internal immutable scale; // 10^(coinDecimals + feedDecimals)

    constructor(IAggregatorV3 feed_, IAggregatorV3 sequencerFeed_, uint256 maxAge_, uint8 coinDecimals) {
        feed = feed_;
        sequencerFeed = sequencerFeed_;
        maxAge = maxAge_;
        scale = 10 ** (uint256(coinDecimals) + feed_.decimals());
    }

    /// USD price of one whole coin, in feed decimals.
    function price() public view returns (uint256) {
        if (address(sequencerFeed) != address(0)) {
            (, int256 down, uint256 startedAt,,) = sequencerFeed.latestRoundData();
            if (down != 0 || block.timestamp - startedAt < SEQUENCER_GRACE) revert SequencerDown();
        }
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0) revert BadPrice();
        if (block.timestamp - updatedAt > maxAge) revert StalePrice();
        return uint256(answer);
    }

    /// USDC value of `qty` coin units. Rounds down.
    function value(uint256 qty) external view returns (uint256) {
        return qty * price() * USDC_UNIT / scale;
    }

    /// Coin units that `usdc` buys at the feed price. Rounds down.
    function quantity(uint256 usdc) external view returns (uint256) {
        return usdc * scale / (price() * USDC_UNIT);
    }
}
