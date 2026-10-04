// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";
import {DeployToken} from "../script/DeployToken.s.sol";
import {Vault} from "../src/Vault.sol";
import {TaxHook} from "../src/token/TaxHook.sol";
import {Keys} from "../src/token/libraries/Keys.sol";
import {MockERC20} from "../src/mocks/Mocks.sol";
import {V4Router} from "./TaxHook.t.sol";

/// Runs the SCR-side deployment script against a real PoolManager and checks the
/// wiring, the mined hook address and that the deployed pool trades.
contract DeployTokenTest is Test {
    uint256 internal constant USDC = 1e6;
    uint256 internal constant SCR = 1e18;

    address internal timelock = makeAddr("timelock");
    address internal treasury = makeAddr("treasury");
    address internal distributor = makeAddr("distributor");
    address internal trader = makeAddr("trader");
    address internal guardian = makeAddr("guardian");

    DeployToken internal script;
    PoolManager internal poolManager;
    MockERC20 internal usdc;
    Vault internal vault;

    function setUp() public {
        script = new DeployToken();
        poolManager = new PoolManager(address(this));
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = new Vault(IERC20(address(usdc)), makeAddr("manager"), timelock, 1_000_000 * USDC, block.timestamp + 7 days, "Bucket");

        address[] memory vaults = new address[](1);
        vaults[0] = address(vault);
        script.deploy(
            DeployToken.Params({
                deployer: address(script),
                timelock: timelock,
                treasury: treasury,
                distributor: distributor,
                guardian: guardian,
                poolManager: IPoolManager(address(poolManager)),
                usdc: IERC20(address(usdc)),
                vaults: vaults,
                schedule: TaxHook.TaxSchedule(2_000, 3_000, 100, 300, 1 hours, 10 minutes)
            })
        );
    }

    function test_hookAddressCarriesItsPermissions() public view {
        uint160 flags = uint160(address(script.hook())) & Hooks.ALL_HOOK_MASK;
        assertEq(
            flags,
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG
        );
        assertGt(address(script.hook()).code.length, 0);
    }

    function testFuzz_mineSaltFindsAFlaggedAddress(bytes32 initCodeHash, address factory) public view {
        (bytes32 salt, address predicted) = script.mineSalt(factory, initCodeHash);
        assertEq(predicted, vm.computeCreate2Address(salt, initCodeHash, factory));
        assertEq(uint160(predicted) & Hooks.ALL_HOOK_MASK, uint160(address(script.hook())) & Hooks.ALL_HOOK_MASK);
    }

    function test_everythingIsWired() public view {
        assertEq(script.registry().get(Keys.TAX_HOOK), address(script.hook()));
        assertTrue(script.registry().locked(Keys.TAX_HOOK));
        assertEq(script.registry().get(Keys.POL_MANAGER), address(script.liquidity()));
        assertTrue(script.registry().locked(Keys.POL_MANAGER));
        assertTrue(script.registry().locked(Keys.CONTRACTION_VAULT));
        assertTrue(script.registry().locked(Keys.EXPANSION_VAULT));
        assertEq(script.sale().guardian(), guardian);
        assertEq(script.registry().get(Keys.FEE_SPLITTER), address(script.splitter()));
        assertEq(script.registry().get(Keys.BACKSTOP_FUND), address(script.fund()));

        assertEq(script.token().centralBank(), address(script.minter()));
        assertEq(address(script.minter().token()), address(script.token()));
        assertEq(script.minter().sale(), address(script.sale()));
        assertEq(script.token().balanceOf(distributor), 900_000_000 * SCR);

        assertEq(address(script.hook().usdc()), address(usdc));
        assertEq(script.hook().sacred(), address(script.token()));
        assertEq(address(script.sale().fund()), address(script.fund()));
        assertEq(address(script.sale().reserve()), address(script.reserve()));
        assertEq(script.fund().reserve(), address(script.reserve()));
        assertEq(address(script.splitter().reserve()), address(script.reserve()));
        assertEq(script.splitter().fund(), address(script.fund()));
        assertEq(script.splitter().treasury(), treasury);

        assertTrue(script.reserve().isListed(address(vault)));
        assertTrue(script.fund().isVault(address(vault)));
    }

    function test_everyContractIsOfferedToTheTimelock() public {
        assertEq(script.registry().pendingOwner(), timelock);
        assertEq(script.minter().pendingOwner(), timelock);
        assertEq(script.hook().pendingOwner(), timelock);
        assertEq(script.liquidity().pendingOwner(), timelock);
        assertEq(script.reserve().pendingOwner(), timelock);
        assertEq(script.fund().pendingOwner(), timelock);
        assertEq(script.sale().pendingOwner(), timelock);

        vm.startPrank(timelock);
        script.minter().acceptOwnership();
        script.hook().acceptOwnership();
        vm.stopPrank();
        assertEq(script.minter().owner(), timelock);
        assertEq(script.hook().owner(), timelock);
    }

    /// The deployer opens the pool before handing over, and a trade pays the fee.
    function test_theDeployedPoolTrades() public {
        bool usdcFirst = script.hook().usdcIsCurrency0();
        (address c0, address c1) =
            usdcFirst ? (address(usdc), address(script.token())) : (address(script.token()), address(usdc));
        PoolKey memory key = PoolKey(Currency.wrap(c0), Currency.wrap(c1), 3000, 60, IHooks(address(script.hook())));
        uint256 ratioX192 = usdcFirst ? uint256(1e13) << 192 : (uint256(1) << 192) / 1e13;

        usdc.mint(address(script.liquidity()), 100_000 * USDC);
        IERC20 token = IERC20(address(script.token()));
        address liquidity = address(script.liquidity());
        vm.prank(distributor);
        token.transfer(liquidity, 1_000_000 * SCR);
        vm.startPrank(address(script));
        script.liquidity().openPool(key, uint160(FixedPointMathLib.sqrt(ratioX192)));
        script.liquidity().addLiquidity(
            TickMath.minUsableTick(60), TickMath.maxUsableTick(60), 3e17, type(uint256).max, type(uint256).max
        );
        vm.stopPrank();

        V4Router router = new V4Router(IPoolManager(address(poolManager)));
        usdc.mint(trader, 1_000 * USDC);
        vm.startPrank(trader);
        usdc.approve(address(router), type(uint256).max);
        router.swap(
            key,
            IPoolManager.SwapParams(
                usdcFirst, -int256(1_000 * USDC), usdcFirst ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            )
        );
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(script.hook())), 200 * USDC, "the 20% launch fee");
        assertGt(script.token().balanceOf(trader), 0);
    }
}
