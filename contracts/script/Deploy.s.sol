// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault, IBackstopFund} from "../src/Vault.sol";
import {Desk, IVault, IFund} from "../src/Desk.sol";
import {Oracle} from "../src/Oracle.sol";
import {BackstopFund} from "../src/BackstopFund.sol";
import {StakedBackstopFund} from "../src/StakedBackstopFund.sol";
import {Reserve} from "../src/Reserve.sol";
import {IAggregatorV3, ISwapRouter} from "../src/interfaces/External.sol";
import {Preflight} from "./Preflight.sol";

/// Production deployment of one term bucket. Not run on any live network yet.
///
/// Environment:
///   PRIVATE_KEY, MANAGER, GUARDIAN, TREASURY
///   TIMELOCK, or MULTISIG to create one
///   USDC, COIN, COIN_DECIMALS, FEED, SEQUENCER_FEED (0x0 only off Arbitrum One), ROUTER
///   (Uniswap v3 SwapRouter02), POOL_FEE, FEED_MAX_AGE (optional, 1 hour)
///   MAX_LEVERAGE_BPS (30000 for BTC, 20000 for ETH), BUCKET_CAP, FIRST_CUTOFF, NAME
///   FUND and RESERVE (optional, both or neither): the staking fund and liquidity
///   reserve from DeployToken. Without them the bucket gets its own USDC-only fund.
///
/// The deployer wires the contracts, then hands every contract to a time-lock that only
/// the multisig can propose to and execute from. Ownership is two-step, so the multisig
/// must schedule and execute `acceptOwnership()` on each contract through the time-lock.
///
/// With FUND and RESERVE set, this script lists the bucket on both, which only their
/// owner can do. Run it with the same deployer as DeployToken, before the time-lock has
/// accepted those two contracts.
contract Deploy is Preflight {
    error FundAndReserveGoTogether();
    error CutoffInThePast();

    address public timelock;
    Oracle public oracle;
    address public fund;
    Vault public vault;
    Desk public desk;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        IERC20 usdc = IERC20(vm.envAddress("USDC"));
        address coin = vm.envAddress("COIN");
        address stakedFund = vm.envOr("FUND", address(0));
        address reserve = vm.envOr("RESERVE", address(0));
        uint256 feedMaxAge = vm.envOr("FEED_MAX_AGE", uint256(1 hours));
        _checkInputs(address(usdc), coin, stakedFund, reserve, feedMaxAge);

        vm.startBroadcast(pk);
        timelock = _timelock();

        oracle = new Oracle(
            IAggregatorV3(vm.envAddress("FEED")), IAggregatorV3(vm.envAddress("SEQUENCER_FEED")), feedMaxAge, uint8(vm.envUint("COIN_DECIMALS"))
        );
        if (stakedFund == address(0)) {
            fund = address(new BackstopFund(usdc, vm.envAddress("TREASURY"), me));
        } else {
            fund = stakedFund;
        }
        vault = new Vault(
            usdc, vm.envAddress("MANAGER"), me, vm.envUint("BUCKET_CAP"), vm.envUint("FIRST_CUTOFF"), vm.envString("NAME")
        );
        desk = new Desk(
            usdc,
            IERC20(coin),
            IVault(address(vault)),
            ISwapRouter(vm.envAddress("ROUTER")),
            uint24(vm.envUint("POOL_FEE")),
            oracle,
            IFund(fund),
            vm.envUint("MAX_LEVERAGE_BPS"),
            me
        );

        vault.setDesk(address(desk));
        vault.setFund(IBackstopFund(fund));
        vault.setGuardian(vm.envAddress("GUARDIAN"));
        desk.setGuardian(vm.envAddress("GUARDIAN"));
        if (stakedFund == address(0)) {
            BackstopFund(fund).setVault(address(vault), true);
            BackstopFund(fund).transferOwnership(timelock);
        } else {
            StakedBackstopFund(fund).setVault(address(vault), true);
            Reserve(reserve).setVault(vault, true);
            vault.setDepositor(reserve, true);
        }

        vault.transferOwnership(timelock);
        desk.transferOwnership(timelock);
        vm.stopBroadcast();

        console2.log("timelock", timelock);
        console2.log("oracle  ", address(oracle));
        console2.log("fund    ", fund);
        console2.log("vault   ", address(vault));
        console2.log("desk    ", address(desk));
    }

    function _checkInputs(address usdc, address coin, address stakedFund, address reserve, uint256 feedMaxAge)
        internal
        view
    {
        _requireDecimals("USDC", usdc, 6);
        _requireDecimals("COIN", coin, uint8(vm.envUint("COIN_DECIMALS")));
        _requireLiveFeed(vm.envAddress("FEED"), feedMaxAge);
        _requireSequencerFeed(vm.envAddress("SEQUENCER_FEED"));
        _requirePool(vm.envAddress("ROUTER"), usdc, coin, uint24(vm.envUint("POOL_FEE")));
        _requireSet("MANAGER", vm.envAddress("MANAGER"));
        _requireSet("GUARDIAN", vm.envAddress("GUARDIAN"));
        _requireSet("TREASURY", vm.envAddress("TREASURY"));
        if ((stakedFund == address(0)) != (reserve == address(0))) revert FundAndReserveGoTogether();
        if (stakedFund != address(0)) {
            _requireContract("FUND", stakedFund);
            _requireContract("RESERVE", reserve);
        }
        if (vm.envUint("FIRST_CUTOFF") <= block.timestamp) revert CutoffInThePast();
    }
}
