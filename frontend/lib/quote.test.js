import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { EARN, LADDER, SIFT } from "./params";
import { apy, borrowQuote, earlySettlement, effectiveCeiling, newFinancing, partialSale, siftCeiling, tradeQuote } from "./quote";

// The worked examples in the docs and on the landing page. If one of these moves, the copy moves.

describe("Trade", () => {
  it("prices the canonical 2x position", () => {
    const q = tradeQuote({ contribution: 5_000 });
    expect(q.exposure).toBe(10_000);
    expect(q.financing).toBe(5_000);
    expect(q.markup).toBeCloseTo(19.18, 2);
    expect(q.execution).toBeCloseTo(11, 8);
    expect(q.totalCost).toBeCloseTo(30.18, 2);
    expect(q.debt).toBeCloseTo(5_019.18, 2);
  });

  it("prices every rung of the ladder the docs table quotes", () => {
    const docs = [
      [2, 19.7, 30.18],
      [2.5, 12.6, 36.32],
      [3, 12.9, 42.96],
      [3.5, 10.2, 49.36],
      [4, 9.4, 57.03],
      [4.5, 9.1, 64.7],
      [5, 7.2, 72.37],
    ];
    expect(LADDER.map((t) => t.leverage)).toEqual(docs.map(([leverage]) => leverage));
    LADDER.forEach((tier, i) => {
      const q = tradeQuote({ contribution: 10_000 / tier.leverage, tier });
      expect(q.exposure).toBeCloseTo(10_000, 6);
      expect(q.priceRoom * 100).toBeCloseTo(docs[i][1], 1);
      expect(q.totalCost).toBeCloseTo(docs[i][2], 2);
    });
  });

  it("prices the Starter position", () => {
    const q = tradeQuote({ contribution: 500 });
    expect(q.exposure).toBe(1_000);
    expect(q.markup).toBeCloseTo(1.92, 2);
    expect(q.execution).toBeCloseTo(2, 8);
    expect(q.totalCost).toBeCloseTo(3.92, 2);
  });

  it("reproduces the canonical price room at every rung", () => {
    const expected = [0.1965297717, 0.1258922612, 0.1287424534, 0.1018992862, 0.0940237242, 0.0910942838, 0.0724787051];
    LADDER.forEach((tier, i) => {
      expect(tradeQuote({ contribution: 10_000 / tier.leverage, tier }).priceRoom).toBeCloseTo(expected[i], 6);
    });
  });

  it("keeps the canonical markup shares", () => {
    LADDER.forEach((tier) => expect(tier.lpShare).toBeCloseTo((0.077 + 0.5 * (tier.apr - 0.1)) / tier.apr, 10));
  });

  it("restores cover with a partial sale", () => {
    const debt = tradeQuote({ contribution: 5_000 }).debt;
    const s = partialSale({ debt, trigger: 1.6, restore: 1.9 });
    expect(s.assetAfter / s.debtAfter).toBeCloseTo(1.9, 10);
    expect(s.sold).toBeCloseTo(1_673.06, 2);
    expect(s.equityAfter).toBeCloseTo(3_011.51, 2);
  });
});

describe("SIFT", () => {
  it("uses the published schedule, byte for byte", () => {
    const file = readFileSync(new URL("./siftSchedule.json", import.meta.url));
    expect(createHash("sha256").update(file).digest("hex")).toBe("00302d386ad05d0b04eeb69d9d32ceb52644217e9654f7dd78f4ccd37a257016");
    expect(SIFT.schedule).toHaveLength(85);
  });

  it("matches the docs table and stops at the first-release maximum", () => {
    const docs = { 0: 500, 7: 2_236, 14: 10_000, 21: 14_953, 28: 22_360, 35: 33_437, 42: 50_000, 56: 62_996, 70: 79_370, 84: 100_000 };
    Object.entries(docs).forEach(([day, ceiling]) => expect(siftCeiling(Number(day))).toBe(ceiling));
    expect(siftCeiling(400)).toBe(100_000);
  });

  it("slows percentage growth at each phase", () => {
    const weekly = (from, to) => (siftCeiling(to) / siftCeiling(from)) ** (7 / (to - from)) - 1;
    expect(weekly(0, 14)).toBeCloseTo(3.4721, 3);
    expect(weekly(14, 42)).toBeCloseTo(0.4953, 3);
    expect(weekly(42, 84)).toBeCloseTo(0.1225, 3);
  });

  it("caps an account at 1% of the vault", () => {
    expect(effectiveCeiling({ q: 84, nav: 1_000_000 })).toBe(10_000);
    expect(effectiveCeiling({ q: 84, nav: 10_000_000 })).toBe(100_000);
    expect(effectiveCeiling({ q: 14, nav: 50_000 })).toBe(500);
  });

  it("binds on what is left of the ceiling, as the docs example does", () => {
    const r = newFinancing({ ceiling: siftCeiling(14), outstanding: 4_000, freshCapital: 8_000 });
    expect(r.financing).toBe(6_000);
    expect(r.binding).toBe("ceiling");
  });

  it("binds on fresh capital, as the docs example does", () => {
    const r = newFinancing({ ceiling: siftCeiling(14), freshCapital: 3_000 });
    expect(r.financing).toBe(3_000);
    expect(r.binding).toBe("capital");
  });
});

describe("Earn", () => {
  it("reproduces the modeled cases from utilization and share", () => {
    EARN.cases.forEach((c) => {
      const apr = c.use * EARN.collectedRate * c.share;
      expect(apr).toBeCloseTo(c.apr, 3);
      expect(apy(apr)).toBeCloseTo(c.apy, 3);
    });
  });
});

describe("Borrow", () => {
  it("prices the reference sale", () => {
    const q = borrowQuote({ collateral: 10_000 });
    expect(q.usdc).toBeCloseTo(4_500, 8);
    expect(q.debt).toBeCloseTo(4_529.59, 2);
    expect(q.triggerValue).toBeCloseTo(7_247.34, 2);
    expect(q.priceRoom).toBeCloseTo(0.2753, 4);
  });

  it("settles early for the days used", () => {
    const { settle, rebate } = earlySettlement({ usdc: 4_500, day: 7 });
    expect(settle).toBeCloseTo(4_506.9, 2);
    expect(rebate).toBeCloseTo(22.68, 2);
  });
});
