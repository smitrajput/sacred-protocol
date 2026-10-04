// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IAggregatorV3} from "../src/interfaces/External.sol";

interface IRouterFactory {
    function factory() external view returns (address);
}

interface IV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

/// Checks the deploy scripts run on their inputs before sending anything. A wrong
/// address in the environment should stop the deployment, not produce a system that
/// reverts later or, worse, one that works against the wrong contract.
abstract contract Preflight is Script {
    uint256 internal constant ARBITRUM_ONE = 42161;
    uint256 internal constant TIMELOCK_DELAY = 2 days;

    error NotAContract(string what, address where);
    error ZeroAddress(string what);
    error WrongDecimals(string what, uint8 expected, uint8 actual);
    error BadPrice(address feed);
    error StalePrice(address feed, uint256 age, uint256 maxAge);
    error SequencerFeedRequired();
    error SequencerDown();
    error NoPool(address tokenA, address tokenB, uint24 fee);
    error MultisigMustBeAContract(address multisig);

    function _requireContract(string memory what, address where) internal view {
        if (where.code.length == 0) revert NotAContract(what, where);
    }

    function _requireSet(string memory what, address where) internal pure {
        if (where == address(0)) revert ZeroAddress(what);
    }

    function _requireDecimals(string memory what, address token, uint8 expected) internal view {
        _requireContract(what, token);
        uint8 actual = IERC20Metadata(token).decimals();
        if (actual != expected) revert WrongDecimals(what, expected, actual);
    }

    /// The feed answers, the answer is positive, and it is no older than the oracle
    /// will accept. A feed that is already stale would make every ticket revert.
    function _requireLiveFeed(address feed, uint256 maxAge) internal view {
        _requireContract("FEED", feed);
        (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(feed).latestRoundData();
        if (answer <= 0) revert BadPrice(feed);
        if (block.timestamp - updatedAt > maxAge) revert StalePrice(feed, block.timestamp - updatedAt, maxAge);
    }

    /// On Arbitrum One the oracle must watch the sequencer, and it must be up now.
    function _requireSequencerFeed(address feed) internal view {
        if (feed == address(0)) {
            if (block.chainid == ARBITRUM_ONE) revert SequencerFeedRequired();
            return;
        }
        _requireContract("SEQUENCER_FEED", feed);
        (, int256 down,,,) = IAggregatorV3(feed).latestRoundData();
        if (down != 0) revert SequencerDown();
    }

    /// The Uniswap v3 pool the desk will trade through exists.
    function _requirePool(address router, address tokenA, address tokenB, uint24 fee) internal view {
        _requireContract("ROUTER", router);
        address pool = IV3Factory(IRouterFactory(router).factory()).getPool(tokenA, tokenB, fee);
        if (pool == address(0) || pool.code.length == 0) revert NoPool(tokenA, tokenB, fee);
    }

    /// Use the time-lock named in TIMELOCK, or create one that only the multisig can
    /// propose to and execute from. On Arbitrum One the multisig must be a contract.
    function _timelock() internal returns (address) {
        address existing = vm.envOr("TIMELOCK", address(0));
        if (existing != address(0)) {
            _requireContract("TIMELOCK", existing);
            return existing;
        }
        address multisig = vm.envAddress("MULTISIG");
        if (block.chainid == ARBITRUM_ONE && multisig.code.length == 0) revert MultisigMustBeAContract(multisig);
        address[] memory roles = new address[](1);
        roles[0] = multisig;
        return address(new TimelockController(TIMELOCK_DELAY, roles, roles, address(0)));
    }
}
