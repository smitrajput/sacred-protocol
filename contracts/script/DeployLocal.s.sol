// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault, IBackstopFund} from "../src/Vault.sol";
import {Desk, IVault, IFund} from "../src/Desk.sol";
import {Oracle} from "../src/Oracle.sol";
import {BackstopFund} from "../src/BackstopFund.sol";
import {IAggregatorV3, ISwapRouter} from "../src/interfaces/External.sol";
import {MockERC20, MockFeed, MockRouter} from "../src/mocks/Mocks.sol";

/// Local demo deployment on anvil with mock USDC, WBTC, feed and market.
/// The deployer is admin and manager. Writes ../deployments/local.json.
contract DeployLocal is Script {
    MockERC20 internal usdc;
    MockERC20 internal coin;
    MockFeed internal feed;
    MockRouter internal router;
    Oracle internal oracle;
    BackstopFund internal fund;
    Vault internal vault;
    Desk internal desk;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address me = vm.addr(pk);
        vm.startBroadcast(pk);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        coin = new MockERC20("Wrapped BTC", "WBTC", 8);
        feed = new MockFeed(8, 60_000e8);
        router = new MockRouter(usdc, coin, 60_000e6);
        oracle = new Oracle(IAggregatorV3(address(feed)), IAggregatorV3(address(0)), 365 days, 8);
        fund = new BackstopFund(IERC20(address(usdc)), me, me);
        vault = new Vault(IERC20(address(usdc)), me, me, 1_000_000e6, block.timestamp + 7 days, "Destiny BTC Term");
        desk = new Desk(
            IERC20(address(usdc)), IERC20(address(coin)), IVault(address(vault)), ISwapRouter(address(router)), 500, oracle, IFund(address(fund)), 30_000, me
        );
        vault.setDesk(address(desk));
        vault.setFund(IBackstopFund(address(fund)));
        vault.setAllowlist(false);
        desk.setAllowlist(false);
        fund.setVault(address(vault), true);
        usdc.mint(me, 1_000_000e6);
        vm.stopBroadcast();

        string memory o = "local";
        vm.serializeAddress(o, "usdc", address(usdc));
        vm.serializeAddress(o, "coin", address(coin));
        vm.serializeAddress(o, "feed", address(feed));
        vm.serializeAddress(o, "router", address(router));
        vm.serializeAddress(o, "oracle", address(oracle));
        vm.serializeAddress(o, "fund", address(fund));
        vm.serializeAddress(o, "vault", address(vault));
        string memory json = vm.serializeAddress(o, "desk", address(desk));
        vm.writeJson(json, "../deployments/local.json");
    }
}
