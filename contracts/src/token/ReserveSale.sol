// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {Reserve} from "../Reserve.sol";
import {StakedBackstopFund} from "../StakedBackstopFund.sol";
import {SacredTokenDummy} from "./SacredTokenDummy.sol";
import {SacredMinter} from "./SacredMinter.sol";
import {TaxHook} from "./TaxHook.sol";

/// @title ReserveSale
/// @notice Sells new SCR for USDC, and every USDC goes straight to the liquidity
///         reserve. The price is the higher of two: the pool's average price less a
///         discount, and the reserve value per token (the reserve's assets divided
///         by the SCR supply). Sales are open only while the reserve is below its
///         target, and are capped per week and by the minter's sale allocation.
///
///         Selling at or above the reserve value per token means a sale never lowers
///         it. When SCR trades below that value the sale price is above the market,
///         so sales stop by themselves.
///
///         Sold SCR is delivered staked in the backstop fund, so the buyer goes
///         through the fund's cooldown before it can be sold.
contract ReserveSale is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error Closed();
    error Paused();
    error NotAllowed();
    error TwapNotReady();
    error ZeroAmount();
    error PeriodCapExceeded();
    error CostAboveMax();
    error OutOfBounds();

    event Sold(address indexed buyer, uint256 scrAmount, uint256 cost, uint256 price);
    event DiscountSet(uint256 discountBps);
    event GuardianSet(address indexed guardian);
    event PausedSet(bool paused);

    uint256 public constant PERIOD = 7 days;
    /// 0.05% of the 1 billion supply per week.
    uint256 public constant PERIOD_CAP = 500_000e18;
    uint256 public constant MAX_DISCOUNT_BPS = 1_000;
    /// The pool's average price must have at least this much history behind it.
    uint256 public constant MIN_TWAP_SPAN = 30 minutes;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant ONE_SCR = 1e18;
    uint256 internal constant Q96 = 1 << 96;

    IERC20 public immutable usdc;
    SacredTokenDummy public immutable token;
    SacredMinter public immutable minter;
    Reserve public immutable reserve;
    TaxHook public immutable hook;
    StakedBackstopFund public immutable fund;

    uint256 public discountBps = 400;
    address public guardian;
    bool public paused;
    mapping(uint256 period => uint256) public soldIn;

    constructor(
        IERC20 usdc_,
        SacredTokenDummy token_,
        SacredMinter minter_,
        Reserve reserve_,
        TaxHook hook_,
        StakedBackstopFund fund_,
        address owner_
    ) Ownable(owner_) {
        fund = fund_;
        usdc = usdc_;
        token = token_;
        minter = minter_;
        reserve = reserve_;
        hook = hook_;
    }

    /// Buy `scrAmount` of new SCR, paying at most `maxCost` USDC.
    function buy(uint256 scrAmount, uint256 maxCost) external nonReentrant returns (uint256 cost) {
        if (paused) revert Paused();
        if (scrAmount == 0) revert ZeroAmount();
        if (!isOpen()) revert Closed();
        if (hook.twapSpan() < MIN_TWAP_SPAN) revert TwapNotReady();

        uint256 period = block.timestamp / PERIOD;
        if (soldIn[period] + scrAmount > PERIOD_CAP) revert PeriodCapExceeded();
        soldIn[period] += scrAmount;

        uint256 unitPrice = price();
        cost = Math.mulDiv(scrAmount, unitPrice, ONE_SCR, Math.Rounding.Ceil);
        if (cost == 0) revert ZeroAmount();
        if (cost > maxCost) revert CostAboveMax();

        usdc.safeTransferFrom(msg.sender, address(reserve), cost);
        minter.mintForSale(address(this), scrAmount);
        IERC20(address(token)).forceApprove(address(fund), scrAmount);
        fund.stakeFor(msg.sender, scrAmount);
        emit Sold(msg.sender, scrAmount, cost, unitPrice);
    }

    /// Sales are open while the reserve is below its target.
    function isOpen() public view returns (bool) {
        return reserve.shortfallToTarget() > 0;
    }

    /// USDC per whole SCR: the higher of the discounted market price and the
    /// reserve value per token.
    function price() public view returns (uint256) {
        uint256 discounted = marketPrice() * (BPS - discountBps) / BPS;
        uint256 floor = reserveValuePerToken();
        return discounted > floor ? discounted : floor;
    }

    /// The pool's time-weighted average price, in USDC per whole SCR.
    function marketPrice() public view returns (uint256) {
        uint256 sqrtPrice = TickMath.getSqrtPriceAtTick(hook.twapTick());
        // The pool quotes currency1 per currency0, as (sqrtPrice / 2^96)^2.
        if (hook.usdcIsCurrency0()) {
            return Math.mulDiv(Math.mulDiv(ONE_SCR, Q96, sqrtPrice), Q96, sqrtPrice);
        }
        return Math.mulDiv(Math.mulDiv(ONE_SCR, sqrtPrice, Q96), sqrtPrice, Q96);
    }

    /// The reserve's assets per whole SCR in supply, rounded up so a sale at this
    /// price cannot lower it.
    function reserveValuePerToken() public view returns (uint256) {
        uint256 supply = token.totalSupply();
        if (supply == 0) return 0;
        return Math.mulDiv(reserve.totalAssets(), ONE_SCR, supply, Math.Rounding.Ceil);
    }

    /// SCR still available in the current week.
    function remainingThisPeriod() external view returns (uint256) {
        return PERIOD_CAP - soldIn[block.timestamp / PERIOD];
    }

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    /// The guardian can stop sales at once. Only the owner can resume them.
    function pause(bool paused_) external {
        if (msg.sender != owner() && !(paused_ && msg.sender == guardian)) revert NotAllowed();
        paused = paused_;
        emit PausedSet(paused_);
    }

    function setDiscountBps(uint256 discountBps_) external onlyOwner {
        if (discountBps_ > MAX_DISCOUNT_BPS) revert OutOfBounds();
        discountBps = discountBps_;
        emit DiscountSet(discountBps_);
    }
}
