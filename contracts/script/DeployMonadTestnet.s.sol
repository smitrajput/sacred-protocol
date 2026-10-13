// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Vault, IBackstopFund} from "../src/Vault.sol";
import {Desk, IVault, IFund} from "../src/Desk.sol";
import {Oracle} from "../src/Oracle.sol";
import {IAggregatorV3, ISwapRouter} from "../src/interfaces/External.sol";
import {MockERC20, MockFeed, MockRouter} from "../src/mocks/Mocks.sol";
import {TaxHook} from "../src/token/TaxHook.sol";
import {DeployToken} from "./DeployToken.s.sol";

/// Monad testnet (chain 10143) deployment, in the shape of the Arbitrum One one: the SCR
/// side, a BTC bucket at 3x and an ETH bucket at 2x on the staking fund and the reserve,
/// every contract offered to a 2-day time-lock.
///
/// The testnet has no native USDC, WBTC or WETH, no Chainlink feeds and no Uniswap v3,
/// so those come from `src/mocks`: open-mint tokens, feeds anyone can set, and a router
/// that swaps at a set price. The SCR pool uses the Monad-maintained Uniswap v4
/// PoolManager. Anyone can move the mock prices, so nothing here is a price reference.
///
/// Environment:
///   PRIVATE_KEY, MULTISIG (the time-lock's proposer and executor)
///   POOL_MANAGER (Uniswap v4)
///   BTC_PRICE, ETH_PRICE (whole USD, seeds the feeds and routers)
///   BUCKET_CAP, FIRST_CUTOFF
/// Writes every address to DEPLOYMENT_OUT (default ../deployments/monad-testnet.json).
contract DeployMonadTestnet is DeployToken {
    uint256 internal constant MONAD_TESTNET = 10143;
    uint24 internal constant POOL_FEE = 500;
    /// Transactions `deploy` sends with no vaults: 8 creations and the hook's CREATE2
    /// call, 8 registry bindings, 4 minter and sale settings, 7 ownership offers.
    uint64 internal constant DEPLOY_TXS = 28;
    /// Nonces the deployer used on Arbitrum One after the SCR side: the two buckets and
    /// what followed (54 in all, from 0).
    uint64 internal constant ARBITRUM_NONCES_AFTER = 54 - 1 - DEPLOY_TXS;

    error WrongChain(uint256 chainId);
    error UsdcMoved(address expected, address actual);

    struct Bucket {
        MockERC20 asset;
        MockFeed feed;
        MockRouter router;
        Oracle oracle;
        Vault vault;
        Desk desk;
    }

    MockERC20 public usdc;
    Bucket internal btc;
    Bucket internal eth;

    function run() external override {
        if (block.chainid != MONAD_TESTNET) revert WrongChain(block.chainid);
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        _requireContract("POOL_MANAGER", vm.envAddress("POOL_MANAGER"));
        if (vm.envUint("FIRST_CUTOFF") <= block.timestamp) revert("FIRST_CUTOFF in the past");

        // The time-lock and the SCR side go first, in the order DeployToken sent them on
        // Arbitrum One, so a fresh deployer puts each at the same address as its Arbitrum
        // twin (all but the hook, whose CREATE2 address depends on its arguments). Their
        // constructors only store USDC, so the mock is deployed later, at an address
        // computed now and checked once it exists.
        uint64 start = vm.getNonce(me);
        address usdcAt = vm.computeCreateAddress(me, start + 1 + DEPLOY_TXS + ARBITRUM_NONCES_AFTER);

        vm.startBroadcast(pk);
        timelock = _timelock();
        deploy(
            Params({
                deployer: me,
                timelock: timelock,
                treasury: me,
                distributor: me,
                guardian: me,
                poolManager: IPoolManager(vm.envAddress("POOL_MANAGER")),
                usdc: IERC20(usdcAt),
                vaults: new address[](0),
                schedule: TaxHook.TaxSchedule(2_000, 3_000, 100, 300, 1 hours, 10 minutes)
            })
        );

        // Past the SCR side, Arbitrum One's addresses hold the buckets, which cannot
        // land there again (each oracle reads a feed that must exist first). Empty
        // transfers to self step over every nonce the deployer used on Arbitrum One, so
        // no address here names a different kind of contract there.
        while (vm.getNonce(me) < start + 1 + DEPLOY_TXS + ARBITRUM_NONCES_AFTER) {
            (bool ok,) = me.call("");
            require(ok);
        }

        // The world the protocol trades in.
        usdc = new MockERC20("USD Coin", "USDC", 6);
        if (address(usdc) != usdcAt) revert UsdcMoved(usdcAt, address(usdc));
        btc.asset = new MockERC20("Wrapped BTC", "WBTC", 8);
        eth.asset = new MockERC20("Wrapped Ether", "WETH", 18);

        _bucket(btc, me, vm.envUint("BTC_PRICE"), 30_000, "Sacred BTC Term");
        _bucket(eth, me, vm.envUint("ETH_PRICE"), 20_000, "Sacred ETH Term");
        vm.stopBroadcast();

        _write();
    }

    /// One term bucket on the staking fund and the reserve, as `Deploy.s.sol` builds it.
    /// The feed never updates on its own, so the oracle accepts a year-old price.
    function _bucket(Bucket storage b, address me, uint256 price, uint256 maxLeverageBps, string memory name)
        internal
    {
        uint8 dec = b.asset.decimals();
        b.feed = new MockFeed(8, int256(price * 1e8));
        b.router = new MockRouter(usdc, b.asset, price * 1e6);
        b.oracle = new Oracle(IAggregatorV3(address(b.feed)), IAggregatorV3(address(0)), 365 days, dec);
        b.vault = new Vault(IERC20(address(usdc)), me, me, vm.envUint("BUCKET_CAP"), vm.envUint("FIRST_CUTOFF"), name);
        b.desk = new Desk(
            IERC20(address(usdc)),
            IERC20(address(b.asset)),
            IVault(address(b.vault)),
            ISwapRouter(address(b.router)),
            POOL_FEE,
            b.oracle,
            IFund(address(fund)),
            maxLeverageBps,
            me
        );

        b.vault.setDesk(address(b.desk));
        b.vault.setFund(IBackstopFund(address(fund)));
        b.vault.setGuardian(me);
        b.desk.setGuardian(me);
        fund.setVault(address(b.vault), true);
        reserve.setVault(b.vault, true);
        b.vault.setDepositor(address(reserve), true);

        b.vault.transferOwnership(timelock);
        b.desk.transferOwnership(timelock);
    }

    function _write() internal {
        string memory o = "monad";
        vm.serializeAddress(o, "timelock", timelock);
        vm.serializeAddress(o, "usdc", address(usdc));
        vm.serializeAddress(o, "registry", address(registry));
        vm.serializeAddress(o, "minter", address(minter));
        vm.serializeAddress(o, "token", address(token));
        vm.serializeAddress(o, "hook", address(hook));
        vm.serializeAddress(o, "liquidity", address(liquidity));
        vm.serializeAddress(o, "reserve", address(reserve));
        vm.serializeAddress(o, "fund", address(fund));
        vm.serializeAddress(o, "splitter", address(splitter));
        vm.serializeAddress(o, "sale", address(sale));
        vm.serializeString(o, "btc", _serialize("btc", btc));
        string memory json = vm.serializeString(o, "eth", _serialize("eth", eth));
        vm.writeJson(json, vm.envOr("DEPLOYMENT_OUT", string("../deployments/monad-testnet.json")));

        console2.log("timelock", timelock);
        console2.log("usdc    ", address(usdc));
        console2.log("token   ", address(token));
        console2.log("btc vault / desk", address(btc.vault), address(btc.desk));
        console2.log("eth vault / desk", address(eth.vault), address(eth.desk));
    }

    function _serialize(string memory key, Bucket storage b) internal returns (string memory) {
        vm.serializeAddress(key, "asset", address(b.asset));
        vm.serializeAddress(key, "feed", address(b.feed));
        vm.serializeAddress(key, "router", address(b.router));
        vm.serializeAddress(key, "oracle", address(b.oracle));
        vm.serializeAddress(key, "vault", address(b.vault));
        return vm.serializeAddress(key, "desk", address(b.desk));
    }
}
