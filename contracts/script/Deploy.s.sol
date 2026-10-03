// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Vault, IBackstopFund} from "../src/Vault.sol";
import {Desk, IVault, IFund} from "../src/Desk.sol";
import {Oracle} from "../src/Oracle.sol";
import {BackstopFund} from "../src/BackstopFund.sol";
import {IAggregatorV3, ISwapRouter} from "../src/interfaces/External.sol";

/// Production deployment of one term bucket. Not run anywhere yet.
///
/// Environment:
///   PRIVATE_KEY, MULTISIG, MANAGER, GUARDIAN, TREASURY
///   USDC, COIN, COIN_DECIMALS, FEED, SEQUENCER_FEED (0x0 if none), ROUTER, POOL_FEE
///   MAX_LEVERAGE_BPS (30000 for BTC, 20000 for ETH), BUCKET_CAP, FIRST_CUTOFF, NAME
///
/// The deployer wires the contracts, then hands every contract to a time-lock that only
/// the multisig can propose to and execute from. Ownership is two-step, so the multisig
/// must schedule and execute `acceptOwnership()` on each contract through the time-lock.
contract Deploy is Script {
    uint256 internal constant TIMELOCK_DELAY = 2 days;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        address multisig = vm.envAddress("MULTISIG");
        IERC20 usdc = IERC20(vm.envAddress("USDC"));
        vm.startBroadcast(pk);

        address[] memory roles = new address[](1);
        roles[0] = multisig;
        TimelockController timelock = new TimelockController(TIMELOCK_DELAY, roles, roles, address(0));

        Oracle oracle = new Oracle(
            IAggregatorV3(vm.envAddress("FEED")),
            IAggregatorV3(vm.envAddress("SEQUENCER_FEED")),
            vm.envOr("FEED_MAX_AGE", uint256(1 hours)),
            uint8(vm.envUint("COIN_DECIMALS"))
        );
        BackstopFund fund = new BackstopFund(usdc, vm.envAddress("TREASURY"), me);
        Vault vault = new Vault(
            usdc, vm.envAddress("MANAGER"), me, vm.envUint("BUCKET_CAP"), vm.envUint("FIRST_CUTOFF"), vm.envString("NAME")
        );
        Desk desk = new Desk(
            usdc,
            IERC20(vm.envAddress("COIN")),
            IVault(address(vault)),
            ISwapRouter(vm.envAddress("ROUTER")),
            uint24(vm.envUint("POOL_FEE")),
            oracle,
            IFund(address(fund)),
            vm.envUint("MAX_LEVERAGE_BPS"),
            me
        );

        vault.setDesk(address(desk));
        vault.setFund(IBackstopFund(address(fund)));
        vault.setGuardian(vm.envAddress("GUARDIAN"));
        desk.setGuardian(vm.envAddress("GUARDIAN"));
        fund.setVault(address(vault), true);

        vault.transferOwnership(address(timelock));
        desk.transferOwnership(address(timelock));
        fund.transferOwnership(address(timelock));
        vm.stopBroadcast();
    }
}
