// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {Vault} from "../src/Vault.sol";
import {Reserve} from "../src/Reserve.sol";
import {StakedBackstopFund} from "../src/StakedBackstopFund.sol";
import {TaxHook} from "../src/token/TaxHook.sol";
import {SacredTokenDummy} from "../src/token/SacredTokenDummy.sol";
import {SacredMinter} from "../src/token/SacredMinter.sol";
import {LiquidityManager} from "../src/token/LiquidityManager.sol";
import {FeeSplitter} from "../src/token/FeeSplitter.sol";
import {ReserveSale} from "../src/token/ReserveSale.sol";
import {AddressRegistry} from "../src/token/AddressRegistry.sol";
import {Keys} from "../src/token/libraries/Keys.sol";
import {Preflight} from "./Preflight.sol";

/// Production deployment of the SCR side: token, minter, pool hook, liquidity manager,
/// reserve, staked backstop fund, fee splitter and reserve sale. Not run on any live
/// network yet. Run it before the buckets, which take FUND and RESERVE from its output.
///
/// Environment:
///   PRIVATE_KEY, TREASURY, GUARDIAN, DISTRIBUTOR (receives the genesis supply)
///   TIMELOCK, or MULTISIG to create one
///   POOL_MANAGER (Uniswap v4), USDC (the pool's and the reserve's dollar)
///   VAULTS (comma-separated buckets to list on the reserve and the fund; optional)
///   START_BUY_BPS, START_SELL_BPS, FLOOR_BUY_BPS, FLOOR_SELL_BPS, LAUNCH_DURATION,
///   LAUNCH_HALF_LIFE (all optional; the defaults are 20%/30% decaying to 1%/3% in an hour)
///
/// Uniswap v4 reads a hook's permissions from the low 14 bits of its address, so the
/// hook is deployed through the CREATE2 factory with a salt searched for here.
///
/// The deployer wires the contracts and offers every one to the time-lock. Ownership is
/// two-step, so the deployer stays owner until the time-lock accepts. Before that, the
/// deployer funds the LiquidityManager and calls `openPool` and `addLiquidity`. The
/// time-lock must also point each bucket at the new fund (`setFund`) and allow the
/// reserve as a depositor (`setDepositor`).
contract DeployToken is Preflight {
    uint160 internal constant HOOK_FLAGS = Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
        | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG
        | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        | Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;

    error NoCreate2Factory();
    error HookDeployFailed();
    error SaltNotFound();

    struct Params {
        address deployer; // owner of everything while the script runs
        address timelock;
        address treasury;
        address distributor;
        address guardian;
        IPoolManager poolManager;
        IERC20 usdc;
        address[] vaults;
        TaxHook.TaxSchedule schedule;
    }

    AddressRegistry public registry;
    SacredMinter public minter;
    SacredTokenDummy public token;
    TaxHook public hook;
    LiquidityManager public liquidity;
    Reserve public reserve;
    StakedBackstopFund public fund;
    FeeSplitter public splitter;
    ReserveSale public sale;
    address public timelock;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        _requireContract("POOL_MANAGER", vm.envAddress("POOL_MANAGER"));
        _requireDecimals("USDC", vm.envAddress("USDC"), 6);
        _requireSet("TREASURY", vm.envAddress("TREASURY"));
        _requireSet("DISTRIBUTOR", vm.envAddress("DISTRIBUTOR"));
        _requireSet("GUARDIAN", vm.envAddress("GUARDIAN"));

        vm.startBroadcast(pk);
        timelock = _timelock();
        Params memory p = Params({
            deployer: vm.addr(pk),
            timelock: timelock,
            treasury: vm.envAddress("TREASURY"),
            distributor: vm.envAddress("DISTRIBUTOR"),
            guardian: vm.envAddress("GUARDIAN"),
            poolManager: IPoolManager(vm.envAddress("POOL_MANAGER")),
            usdc: IERC20(vm.envAddress("USDC")),
            vaults: vm.envOr("VAULTS", ",", new address[](0)),
            schedule: TaxHook.TaxSchedule({
                startBuyBps: vm.envOr("START_BUY_BPS", uint256(2_000)),
                startSellBps: vm.envOr("START_SELL_BPS", uint256(3_000)),
                floorBuyBps: vm.envOr("FLOOR_BUY_BPS", uint256(100)),
                floorSellBps: vm.envOr("FLOOR_SELL_BPS", uint256(300)),
                duration: vm.envOr("LAUNCH_DURATION", uint256(1 hours)),
                halfLife: vm.envOr("LAUNCH_HALF_LIFE", uint256(10 minutes))
            })
        });
        deploy(p);
        vm.stopBroadcast();

        console2.log("timelock ", timelock);
        console2.log("registry ", address(registry));
        console2.log("minter   ", address(minter));
        console2.log("token    ", address(token));
        console2.log("hook     ", address(hook));
        console2.log("liquidity", address(liquidity));
        console2.log("reserve  ", address(reserve));
        console2.log("fund     ", address(fund));
        console2.log("splitter ", address(splitter));
        console2.log("sale     ", address(sale));
    }

    function deploy(Params memory p) public {
        address me = p.deployer;
        registry = new AddressRegistry(me);
        minter = new SacredMinter(me);
        token = new SacredTokenDummy(address(minter), registry, address(p.poolManager));
        hook = _deployHook(abi.encode(p.poolManager, token, p.usdc, registry, me, p.schedule));
        liquidity = new LiquidityManager(p.poolManager, me);
        reserve = new Reserve(p.usdc, me);
        fund = new StakedBackstopFund(
            p.usdc, IERC20(address(token)), p.treasury, address(reserve), p.poolManager, hook, me
        );
        splitter = new FeeSplitter(p.usdc, p.treasury, reserve, address(fund));
        sale = new ReserveSale(p.usdc, token, minter, reserve, hook, fund, me);

        registry.set(Keys.TAX_HOOK, address(hook));
        registry.lock(Keys.TAX_HOOK); // changing the hook means a new pool
        registry.set(Keys.POL_MANAGER, address(liquidity));
        registry.lock(Keys.POL_MANAGER); // the pool's liquidity cannot move to another manager
        // Bindings this system does not use. Locked empty, so nobody can later be
        // given the token's launch-cap exemption through them.
        registry.lockDisabled(Keys.CONTRACTION_VAULT);
        registry.lockDisabled(Keys.EXPANSION_VAULT);
        registry.set(Keys.FEE_SPLITTER, address(splitter));
        registry.set(Keys.BACKSTOP_FUND, address(fund));
        minter.bind(token);
        minter.genesis(p.distributor);
        minter.setSale(address(sale));
        sale.setGuardian(p.guardian);
        for (uint256 i; i < p.vaults.length; ++i) {
            reserve.setVault(Vault(p.vaults[i]), true);
            fund.setVault(p.vaults[i], true);
        }

        registry.transferOwnership(p.timelock);
        minter.transferOwnership(p.timelock);
        hook.transferOwnership(p.timelock);
        liquidity.transferOwnership(p.timelock);
        reserve.transferOwnership(p.timelock);
        fund.transferOwnership(p.timelock);
        sale.transferOwnership(p.timelock);
    }

    /// Deploy the hook through the CREATE2 factory at an address whose low 14 bits are
    /// exactly the hook's permissions.
    function _deployHook(bytes memory args) internal returns (TaxHook) {
        if (CREATE2_FACTORY.code.length == 0) revert NoCreate2Factory();
        bytes memory initCode = abi.encodePacked(type(TaxHook).creationCode, args);
        (bytes32 salt, address predicted) = mineSalt(CREATE2_FACTORY, keccak256(initCode));
        (bool ok,) = CREATE2_FACTORY.call(abi.encodePacked(salt, initCode));
        if (!ok || predicted.code.length == 0) revert HookDeployFailed();
        return TaxHook(predicted);
    }

    /// Search salts from zero for a CREATE2 address that carries the hook's flags.
    /// One salt in 16,384 fits, so the search is short.
    function mineSalt(address factory, bytes32 initCodeHash) public pure returns (bytes32 salt, address predicted) {
        for (uint256 i; i < 1_000_000; ++i) {
            salt = bytes32(i);
            predicted = vm.computeCreate2Address(salt, initCodeHash, factory);
            if (uint160(predicted) & Hooks.ALL_HOOK_MASK == HOOK_FLAGS) return (salt, predicted);
        }
        revert SaltNotFound();
    }
}
