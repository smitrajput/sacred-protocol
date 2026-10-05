// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DeployLocal} from "../script/DeployLocal.s.sol";

/// Runs the local deployment script as `anvil` would see it and checks that every
/// part is wired to every other: the bucket to the staking fund and the reserve, the
/// sale to the minter, the pool open with liquidity, and the deployer able to act in
/// every role.
contract DeployLocalTest is Test {
    uint256 internal constant USDC = 1e6;
    address internal constant ME = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // anvil's first account

    DeployLocal internal script;

    function setUp() public {
        vm.warp(1_760_000_000);
        vm.setEnv("DEPLOYMENT_OUT", "../deployments/test.json");
        script = new DeployLocal();
        script.run();
    }

    function test_theBucketIsOnTheStakingFundAndTheReserve() public view {
        assertEq(script.vault().desk(), address(script.desk()));
        assertEq(address(script.vault().fund()), address(script.fund()));
        assertEq(address(script.desk().fund()), address(script.fund()));
        assertTrue(script.fund().isVault(address(script.vault())));
        assertTrue(script.reserve().isListed(address(script.vault())));
        assertTrue(script.vault().depositorAllowed(address(script.reserve())));
        assertEq(script.reserve().operator(), ME);
        assertFalse(script.vault().allowlistOn());
        assertFalse(script.desk().allowlistOn());
    }

    function test_thePoolIsOpenWithLiquidity() public view {
        assertTrue(script.liquidity().poolOpened());
        assertTrue(script.hook().poolInitialized());
        assertGt(script.usdc().balanceOf(address(script.poolManager())), 90_000 * USDC);
        assertGt(script.token().balanceOf(address(script.poolManager())), 900_000e18);
    }

    function test_theDeployerHoldsEveryRoleAndTheMoney() public view {
        assertEq(script.vault().owner(), ME);
        assertEq(script.desk().owner(), ME);
        assertEq(script.fund().owner(), ME);
        assertEq(script.sale().owner(), ME);
        assertEq(script.vault().manager(), ME);
        assertEq(script.usdc().balanceOf(ME), 1_000_000 * USDC);
        assertEq(script.token().balanceOf(ME), 899_000_000e18);
        assertEq(address(script.minter().token()), address(script.token()));
        assertEq(script.minter().sale(), address(script.sale()));
    }

    function test_writesEveryAddress() public view {
        string memory json = vm.readFile("../deployments/test.json");
        assertEq(vm.parseJsonAddress(json, ".vault"), address(script.vault()));
        assertEq(vm.parseJsonAddress(json, ".sale"), address(script.sale()));
        assertEq(vm.parseJsonAddress(json, ".fund"), address(script.fund()));
        assertEq(vm.parseJsonAddress(json, ".token"), address(script.token()));
        assertEq(vm.parseJsonAddress(json, ".reserve"), address(script.reserve()));
    }
}
