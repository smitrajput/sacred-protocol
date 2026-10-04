// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";

/// @title LiquidityManager
/// @notice Holds the protocol's own liquidity in the USDC/SCR pool (the hook's
///         `POL_MANAGER`). It opens the pool and adds liquidity from the tokens sent
///         to it. There is no function that removes liquidity or sends tokens
///         anywhere else, so what is added is never withdrawn. Swap fees can be
///         collected into this contract, from where they can only be added back.
contract LiquidityManager is Ownable2Step, IUnlockCallback {
    using SafeERC20 for IERC20;

    error NotPoolManager();
    error AlreadyInitialized();
    error NotInitialized();
    error ZeroLiquidity();
    error SlippageExceeded();

    event PoolOpened(uint160 sqrtPriceX96);
    event LiquidityAdded(int24 tickLower, int24 tickUpper, uint256 liquidity, uint256 amount0, uint256 amount1);
    event FeesCollected(int24 tickLower, int24 tickUpper, uint256 amount0, uint256 amount1);

    IPoolManager public immutable poolManager;
    PoolKey public poolKey;
    bool public poolOpened;

    constructor(IPoolManager poolManager_, address owner_) Ownable(owner_) {
        poolManager = poolManager_;
    }

    /// Open the pool at a starting price. Once.
    function openPool(PoolKey calldata key, uint160 sqrtPriceX96) external onlyOwner {
        if (poolOpened) revert AlreadyInitialized();
        poolOpened = true;
        poolKey = key;
        poolManager.initialize(key, sqrtPriceX96);
        emit PoolOpened(sqrtPriceX96);
    }

    /// Add liquidity to a range from this contract's balances. `max0` and `max1`
    /// bound what each side may cost.
    function addLiquidity(int24 tickLower, int24 tickUpper, uint256 liquidity, uint256 max0, uint256 max1)
        external
        onlyOwner
        returns (uint256 amount0, uint256 amount1)
    {
        if (!poolOpened) revert NotInitialized();
        if (liquidity == 0) revert ZeroLiquidity();
        BalanceDelta delta = _modify(tickLower, tickUpper, int256(liquidity));
        amount0 = _owed(delta.amount0());
        amount1 = _owed(delta.amount1());
        if (amount0 > max0 || amount1 > max1) revert SlippageExceeded();
        emit LiquidityAdded(tickLower, tickUpper, liquidity, amount0, amount1);
    }

    /// Pull a position's swap fees into this contract. Anyone may call.
    function collectFees(int24 tickLower, int24 tickUpper) external returns (uint256 amount0, uint256 amount1) {
        if (!poolOpened) revert NotInitialized();
        BalanceDelta delta = _modify(tickLower, tickUpper, 0);
        amount0 = uint256(uint128(delta.amount0()));
        amount1 = uint256(uint128(delta.amount1()));
        emit FeesCollected(tickLower, tickUpper, amount0, amount1);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        IPoolManager.ModifyLiquidityParams memory params = abi.decode(data, (IPoolManager.ModifyLiquidityParams));
        PoolKey memory key = poolKey;
        (BalanceDelta delta,) = poolManager.modifyLiquidity(key, params, "");
        _settle(key.currency0, delta.amount0());
        _settle(key.currency1, delta.amount1());
        return abi.encode(delta);
    }

    function _modify(int24 tickLower, int24 tickUpper, int256 liquidityDelta) internal returns (BalanceDelta) {
        bytes memory result = poolManager.unlock(
            abi.encode(IPoolManager.ModifyLiquidityParams(tickLower, tickUpper, liquidityDelta, bytes32(0)))
        );
        return abi.decode(result, (BalanceDelta));
    }

    /// Pay what the pool is owed, or take what it owes, always to this contract.
    function _settle(Currency currency, int128 amount) internal {
        if (amount < 0) {
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), uint128(-amount));
            poolManager.settle();
        } else if (amount > 0) {
            poolManager.take(currency, address(this), uint128(amount));
        }
    }

    function _owed(int128 amount) internal pure returns (uint256) {
        return amount < 0 ? uint256(uint128(-amount)) : 0;
    }
}
