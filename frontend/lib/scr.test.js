import { describe, expect, it } from "vitest";
import { DAY } from "./math.js";
import { COOLDOWN, SCR, UNSTAKE_WINDOW, saleCost, sharesFor, stakeBehind, unstakePhase, withSlack } from "./scr.js";

const USDC = 1_000_000n;

describe("stakes and shares mirror the fund", () => {
  it("the first stake is one share per SCR", () => {
    expect(sharesFor(10_000n * SCR, 0n, 0n)).toBe(10_000n * SCR);
  });

  it("later stakes get shares in proportion, rounded up", () => {
    // 1,000 SCR behind 500 shares after a shortfall sale: 2 SCR per share.
    expect(sharesFor(10n * SCR, 500n, 1_000n * SCR)).toBe(5n);
    expect(sharesFor(3n * SCR, 500n, 1_000n * SCR)).toBe(2n); // 1.5 rounds up
    expect(stakeBehind(5n, 500n, 1_000n * SCR)).toBe(10n * SCR);
    expect(stakeBehind(5n, 0n, 0n)).toBe(0n);
  });
});

describe("leaving the stake", () => {
  const readyAt = 1_000n + COOLDOWN;
  const request = { shares: 7n, readyAt };

  it("is a cooldown, then a window, then a missed window", () => {
    expect(unstakePhase(request, 1_000n)).toEqual({ phase: "cooling", shares: 7n, until: readyAt });
    expect(unstakePhase(request, readyAt)).toEqual({ phase: "open", shares: 7n, until: readyAt + UNSTAKE_WINDOW });
    expect(unstakePhase(request, readyAt + UNSTAKE_WINDOW)).toMatchObject({ phase: "open" });
    expect(unstakePhase(request, readyAt + UNSTAKE_WINDOW + 1n)).toEqual({
      phase: "missed",
      shares: 7n,
      since: readyAt + UNSTAKE_WINDOW,
    });
  });

  it("has no phase without a request", () => {
    expect(unstakePhase(undefined, 5n)).toEqual({ phase: "none" });
    expect(unstakePhase({ shares: 0n, readyAt: 0n }, 5n)).toEqual({ phase: "none" });
  });

  it("uses the contract's 14 and 7 days", () => {
    expect(COOLDOWN).toBe(14n * DAY);
    expect(UNSTAKE_WINDOW).toBe(7n * DAY);
  });
});

describe("the reserve sale", () => {
  it("charges amount times price, rounded up", () => {
    expect(saleCost(1_000n * SCR, 96_000n)).toBe(96n * USDC); // 0.096 USDC per SCR
    expect(saleCost(1n, 96_000n)).toBe(1n); // a dust amount still costs a unit
  });

  it("leaves 1% of room for the average price to move", () => {
    expect(withSlack(100n * USDC)).toBe(101n * USDC);
    expect(withSlack(100n * USDC, 50n)).toBe(100_500_000n);
  });
});
