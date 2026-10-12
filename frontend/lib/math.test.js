import { describe, expect, it } from "vitest";
import { DAY, cost, earned, exitPreview, formatAmount, formatUsdc, markup, parseUsdc, profitShare, quantityAt, quote, settlement, valueAt } from "./math.js";

const USDC = 1_000_000n;
const launch = { baseRateBps: 1_550n, surchargeBps: 150n, surchargeAboveBps: 20_000n };

describe("position math matches the contract and the design example", () => {
  it("1,000 down on BTC at 3x for 14 days costs 13.04", () => {
    const q = quote({ downPayment: 1_000n * USDC, leverageBps: 30_000n, termDays: 14, ...launch });
    expect(q.cost).toBe(3_000n * USDC);
    expect(q.financed).toBe(2_000n * USDC);
    expect(q.markup).toBe(13_041_095n); // 2,000 × 17% × 14 ÷ 365, floored as PositionMath does
    expect(q.balance).toBe(2_013_041_095n);
    expect(q.rateBps).toBe(1_700n);
  });

  it("no gap premium at or below 2x", () => {
    expect(quote({ downPayment: 1_000n * USDC, leverageBps: 20_000n, termDays: 7, ...launch }).rateBps).toBe(1_550n);
  });

  it("cost and markup primitives", () => {
    expect(cost(1_000n * USDC, 30_000n)).toBe(3_000n * USDC);
    expect(markup(2_000n * USDC, 1_700n, 14n * DAY)).toBe(13_041_095n);
  });

  it("earned markup: one day minimum, linear, capped at the full markup", () => {
    const m = 13_041_095n;
    expect(earned(m, 0n, 14n * DAY, 0n)).toBe(m / 14n);
    expect(earned(m, 0n, 14n * DAY, 5n * DAY)).toBe(4_657_533n);
    expect(earned(m, 0n, 14n * DAY, 14n * DAY)).toBe(m);
    expect(earned(m, 0n, 14n * DAY, 99n * DAY)).toBe(m);
  });

  it("settlement on day 5 is 2,004.66 and falls with part payments", () => {
    expect(settlement(2_000n * USDC, 13_041_095n, 0n, 0n, 14n * DAY, 5n * DAY)).toBe(2_004_657_533n);
    expect(settlement(2_000n * USDC, 13_041_095n, 500n * USDC, 0n, 14n * DAY, 5n * DAY)).toBe(1_504_657_533n);
  });

  it("profit share is 10% of profit and zero without profit", () => {
    expect(profitShare(1_586_958_905n, 1_000n * USDC)).toBe(58_695_890n);
    expect(profitShare(900n * USDC, 1_000n * USDC)).toBe(0n);
    expect(profitShare(1_000n * USDC, 1_000n * USDC)).toBe(0n);
  });
});

describe("exit preview", () => {
  it("BTC up 20% at the due date: trader keeps 1,528.26", () => {
    const p = exitPreview({ assetValue: 3_600n * USDC, settlementAmount: 2_013_041_095n, paidIn: 1_000n * USDC });
    expect(p.canClose).toBe(true);
    expect(p.toFund).toBe(58_695_890n);
    expect(formatUsdc(p.toTrader)).toBe("1,528.26");
  });

  it("cannot close when the asset is worth less than the settlement amount", () => {
    expect(exitPreview({ assetValue: 1_800n * USDC, settlementAmount: 2_013_041_095n, paidIn: 1_000n * USDC }).canClose).toBe(false);
  });

  it("a losing close shares nothing", () => {
    const p = exitPreview({ assetValue: 2_700n * USDC, settlementAmount: 2_013_041_095n, paidIn: 1_000n * USDC });
    expect(p.toFund).toBe(0n);
    expect(p.toTrader).toBe(686_958_905n);
  });
});

describe("formatting and parsing", () => {
  it("formats with thousands separators and rounds half up", () => {
    expect(formatUsdc(2_013_041_095n)).toBe("2,013.04");
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
    expect(qty).toBe(800_000_000_000_000_000n); // 0.8 asset
    expect(valueAt(qty, price, 18)).toBe(2_000n * USDC);
  });
});
