import { describe, expect, it } from "vitest";
import { DAY, cost, earned, exitPreview, formatAmount, formatUsdc, markup, parseUsdc, profitShare, quantityAt, quote, settlement, valueAt } from "./math.js";

const USDC = 1_000_000n;
const launch = { baseRateBps: 1_000n, surchargeBps: 100n, surchargeAboveBps: 20_000n };

describe("ticket math matches the contract and the design example", () => {
  it("1,000 down on BTC at 3x for 14 days costs 8.44", () => {
    const q = quote({ downPayment: 1_000n * USDC, leverageBps: 30_000n, termDays: 14, ...launch });
    expect(q.cost).toBe(3_000n * USDC);
    expect(q.financed).toBe(2_000n * USDC);
    expect(q.markup).toBe(8_438_356n); // same integer as TicketMath.t.sol
    expect(q.balance).toBe(2_008_438_356n);
    expect(q.rateBps).toBe(1_100n);
  });

  it("no surcharge at or below 2x", () => {
    expect(quote({ downPayment: 1_000n * USDC, leverageBps: 20_000n, termDays: 7, ...launch }).rateBps).toBe(1_000n);
  });

  it("cost and markup primitives", () => {
    expect(cost(1_000n * USDC, 30_000n)).toBe(3_000n * USDC);
    expect(markup(2_000n * USDC, 1_100n, 14n * DAY)).toBe(8_438_356n);
  });

  it("earned markup: one day minimum, linear, capped at the full markup", () => {
    const m = 8_438_356n;
    expect(earned(m, 0n, 14n * DAY, 0n)).toBe(m / 14n);
    expect(earned(m, 0n, 14n * DAY, 5n * DAY)).toBe(3_013_698n);
    expect(earned(m, 0n, 14n * DAY, 14n * DAY)).toBe(m);
    expect(earned(m, 0n, 14n * DAY, 99n * DAY)).toBe(m);
  });

  it("settlement on day 5 is 2,003.01 and falls with part payments", () => {
    expect(settlement(2_000n * USDC, 8_438_356n, 0n, 0n, 14n * DAY, 5n * DAY)).toBe(2_003_013_698n);
    expect(settlement(2_000n * USDC, 8_438_356n, 500n * USDC, 0n, 14n * DAY, 5n * DAY)).toBe(1_503_013_698n);
  });

  it("profit share is 30% of profit and zero without profit", () => {
    expect(profitShare(1_591_561_644n, 1_000n * USDC)).toBe(177_468_493n);
    expect(profitShare(900n * USDC, 1_000n * USDC)).toBe(0n);
    expect(profitShare(1_000n * USDC, 1_000n * USDC)).toBe(0n);
  });
});

describe("exit preview", () => {
  it("BTC up 20% at the due date: trader keeps 1,414.09", () => {
    const p = exitPreview({ coinValue: 3_600n * USDC, settlementAmount: 2_008_438_356n, paidIn: 1_000n * USDC });
    expect(p.canClose).toBe(true);
    expect(p.toFund).toBe(177_468_493n);
    expect(formatUsdc(p.toTrader)).toBe("1,414.09");
  });

  it("cannot close when the coin is worth less than the settlement amount", () => {
    expect(exitPreview({ coinValue: 1_800n * USDC, settlementAmount: 2_008_438_356n, paidIn: 1_000n * USDC }).canClose).toBe(false);
  });

  it("a losing close shares nothing", () => {
    const p = exitPreview({ coinValue: 2_700n * USDC, settlementAmount: 2_008_438_356n, paidIn: 1_000n * USDC });
    expect(p.toFund).toBe(0n);
    expect(p.toTrader).toBe(691_561_644n);
  });
});

describe("formatting and parsing", () => {
  it("formats with thousands separators and rounds half up", () => {
    expect(formatUsdc(2_008_438_356n)).toBe("2,008.44");
    expect(formatUsdc(0n)).toBe("0.00");
    expect(formatUsdc(-1_500_000n)).toBe("-1.50");
    expect(formatUsdc(999_995n)).toBe("1.00");
  });

  it("parses user input exactly and rejects junk", () => {
    expect(parseUsdc("1,000")).toBe(1_000n * USDC);
    expect(parseUsdc("0.000001")).toBe(1n);
    expect(parseUsdc("12.5")).toBe(12_500_000n);
    expect(parseUsdc("")).toBe(null);
    expect(parseUsdc("abc")).toBe(null);
    expect(parseUsdc("1.0000001")).toBe(null);
    expect(parseUsdc("-5")).toBe(null);
  });
});

describe("display helpers", () => {
  it("formats token amounts with any number of decimals", () => {
    expect(formatAmount(742_700_000_000_000_000n, 18, 4)).toBe("0.7427");
    expect(formatAmount(1_234_567_890n, 6, 2)).toBe("1,234.57");
  });

  it("quantity and value mirror the oracle", () => {
    const price = 2_500n * USDC;
    const qty = quantityAt(2_000n * USDC, price, 18);
    expect(qty).toBe(800_000_000_000_000_000n); // 0.8 coin
    expect(valueAt(qty, price, 18)).toBe(2_000n * USDC);
  });
});
