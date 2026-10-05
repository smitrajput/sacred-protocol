// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {Vault, IBackstopFund} from "../src/Vault.sol";
import {Desk, IVault, IFund} from "../src/Desk.sol";
import {Oracle} from "../src/Oracle.sol";
import {IAggregatorV3, ISwapRouter} from "../src/interfaces/External.sol";
import {MockERC20, MockFeed, MockRouter} from "../src/mocks/Mocks.sol";
import {TaxHook} from "../src/token/TaxHook.sol";
import {DeployToken} from "./DeployToken.s.sol";

/// Local deployment of the whole system on anvil: mock USDC, WBTC, feed and spot
/// market; a real Uniswap v4 PoolManager; the SCR side exactly as `DeployToken` ships
/// it, with the pool opened and the protocol's liquidity in it; and one BTC term bucket
/// wired to the staking fund and the reserve. The deployer is admin, manager, treasury,
/// guardian, distributor, reserve operator and time-lock, and holds 1,000,000 USDC and
/// the genesis SCR. Allow-lists are off. Writes every address to DEPLOYMENT_OUT
/// (default ../deployments/local.json).
contract DeployLocal is DeployToken {
    /// anvil's first account. Fixed here, not read from the environment, so a `.env` written
    /// for a live chain can never leak into a local run.
    uint256 internal constant ANVIL_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 internal constant PRICE = 60_000; // USD per BTC at the start
    int24 internal constant SPACING = 60;

    MockERC20 public usdc;
    MockERC20 public coin;
    MockFeed public feed;
    MockRouter public router;
    PoolManager public poolManager;
    Oracle public oracle;
    Vault public vault;
    Desk public desk;

    function run() external override {
        address me = vm.addr(ANVIL_KEY);
        vm.startBroadcast(ANVIL_KEY);

        // The world the protocol trades in.
        usdc = new MockERC20("USD Coin", "USDC", 6);
        coin = new MockERC20("Wrapped BTC", "WBTC", 8);
        feed = new MockFeed(8, int256(PRICE * 1e8));
        router = new MockRouter(usdc, coin, PRICE * 1e6);
        poolManager = new PoolManager(me);

        // The SCR side, then the pool it settles through.
        deploy(
            Params({
                deployer: me,
                timelock: me,
                treasury: me,
                distributor: me,
                guardian: me,
                poolManager: IPoolManager(address(poolManager)),
                usdc: IERC20(address(usdc)),
                vaults: new address[](0),
                schedule: TaxHook.TaxSchedule(2_000, 3_000, 100, 300, 1 hours, 10 minutes)
            })
        );
        _openPool();

        // One BTC term bucket, at 3x, on the staking fund and the reserve.
        oracle = new Oracle(IAggregatorV3(address(feed)), IAggregatorV3(address(0)), 365 days, 8);
        vault = new Vault(IERC20(address(usdc)), me, me, 1_000_000e6, block.timestamp + 7 days, "Sacred BTC Term");
        desk = new Desk(
            IERC20(address(usdc)),
            IERC20(address(coin)),
            IVault(address(vault)),
            ISwapRouter(address(router)),
            500,
            oracle,
            IFund(address(fund)),
            30_000,
            me
        );
        vault.setDesk(address(desk));
        vault.setFund(IBackstopFund(address(fund)));
        vault.setAllowlist(false);
        vault.setDepositor(address(reserve), true);
        desk.setAllowlist(false);
        fund.setVault(address(vault), true);
        reserve.setVault(vault, true);
        reserve.setOperator(me);
        usdc.mint(me, 1_000_000e6);
        vm.stopBroadcast();

        _write();
    }

    /// The pool opens at 0.10 USDC per SCR with about 95,000 USDC and 950,000 SCR of
    /// the protocol's own liquidity, as the deployer does after `DeployToken` on a
    /// live chain.
    function _openPool() internal {
        bool usdcFirst = hook.usdcIsCurrency0();
        (address c0, address c1) = usdcFirst ? (address(usdc), address(token)) : (address(token), address(usdc));
        PoolKey memory key = PoolKey(Currency.wrap(c0), Currency.wrap(c1), 3000, SPACING, IHooks(address(hook)));
        uint256 ratioX192 = usdcFirst ? uint256(1e13) << 192 : (uint256(1) << 192) / 1e13;

        usdc.mint(address(liquidity), 100_000e6);
        token.transfer(address(liquidity), 1_000_000e18);
        liquidity.openPool(key, uint160(FixedPointMathLib.sqrt(ratioX192)));
        liquidity.addLiquidity(
            TickMath.minUsableTick(SPACING), TickMath.maxUsableTick(SPACING), 3e17, type(uint256).max, type(uint256).max
        );
    }

    function _write() internal {
        string memory o = "local";
        vm.serializeAddress(o, "usdc", address(usdc));
        vm.serializeAddress(o, "coin", address(coin));
        vm.serializeAddress(o, "feed", address(feed));
        vm.serializeAddress(o, "router", address(router));
        vm.serializeAddress(o, "poolManager", address(poolManager));
        vm.serializeAddress(o, "oracle", address(oracle));
        vm.serializeAddress(o, "vault", address(vault));
        vm.serializeAddress(o, "desk", address(desk));
        vm.serializeAddress(o, "registry", address(registry));
        vm.serializeAddress(o, "minter", address(minter));
        vm.serializeAddress(o, "token", address(token));
        vm.serializeAddress(o, "hook", address(hook));
        vm.serializeAddress(o, "liquidity", address(liquidity));
        vm.serializeAddress(o, "reserve", address(reserve));
        vm.serializeAddress(o, "fund", address(fund));
        vm.serializeAddress(o, "splitter", address(splitter));
        string memory json = vm.serializeAddress(o, "sale", address(sale));
        vm.writeJson(json, vm.envOr("DEPLOYMENT_OUT", string("../deployments/local.json")));
    }
}
