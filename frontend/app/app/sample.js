import { DESK_DEFAULTS } from "../../lib/defaults";
import { DAY, cost, markup, quantityAt } from "../../lib/math";
import { priceToUnits } from "../../lib/price";

// Sample figures for the preview, shown while no contract addresses are configured. The
// tickets are built with the contract's own arithmetic around today's spot price so every
// column is internally consistent. Nothing here is real.

const FALLBACK_PRICE = 2_500; // when the spot price could not be fetched

export function sampleData({ spotPrice, coinDecimals, now }) {
  const price = spotPrice ?? FALLBACK_PRICE;
  const nowS = BigInt(now);

  // One ticket as the Desk would store it. `openedAt` is the price then, relative to today's.
  const ticket = (id, { down, leverageBps, termDays, openedDaysAgo, openedAt, status = 1 }) => {
    const downPayment = BigInt(down) * 1_000_000n;
    const total = cost(downPayment, leverageBps);
    const financed = total - downPayment;
    const rateBps =
      DESK_DEFAULTS.baseRateBps + (leverageBps > DESK_DEFAULTS.surchargeAboveBps ? DESK_DEFAULTS.surchargeBps : 0n);
    const term = BigInt(termDays) * DAY;
    const opened = nowS - BigInt(openedDaysAgo) * DAY;
    return {
      id: BigInt(id),
      owner: "sample",
      status,
      opened,
      due: opened + term,
      qty: quantityAt(total, priceToUnits(price * openedAt), coinDecimals),
      cost: total,
      downPayment,
      financed,
      markup: markup(financed, rateBps, term),
      repaid: 0n,
      principalRepaid: 0n,
    };
  };

  // The weekly cut-off: the coming Friday at 00:00 UTC.
  const today = new Date(now * 1000);
  const daysToFriday = (5 - today.getUTCDay() + 7) % 7 || 7;
  const nextCutoff = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysToFriday) / 1000;

  return {
    bucket: {
      idle: 176_320_000_000n,
      lent: 636_080_000_000n,
      reserve: 6_118_520_000n,
      lastPrice: 1_004_213_000_000_000_000n,
      nextCutoff: BigInt(nextCutoff),
      myShares: 0n,
      myDeposit: 0n,
      myWithdraw: 0n,
    },
    tickets: [
      ticket(41, { down: 1_000, leverageBps: 20_000n, termDays: 14, openedDaysAgo: 5, openedAt: 0.97 }),
      ticket(38, { down: 2_500, leverageBps: 15_000n, termDays: 7, openedDaysAgo: 3, openedAt: 1.03 }),
      ticket(27, { down: 500, leverageBps: 20_000n, termDays: 7, openedDaysAgo: 12, openedAt: 0.99, status: 2 }),
    ],
  };
}
