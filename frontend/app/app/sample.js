import { DESK_DEFAULTS } from "../../lib/defaults";
import { DAY, cost, markup, quantityAt, settlement, valueAt } from "../../lib/math";
import { priceToUnits } from "../../lib/price";
import { SCR } from "../../lib/scr";

// Sample figures for the preview, shown while no contract addresses are configured. The
// tickets are built with the contract's own arithmetic around today's spot price so every
// column is internally consistent. Nothing here is real.

const FALLBACK_PRICE = 2_500; // when the spot price could not be fetched
const USDC = 1_000_000n;

export function sampleData({ spotPrice, coinDecimals, now }) {
  const price = spotPrice ?? FALLBACK_PRICE;
  const nowS = BigInt(now);
  const priceUnits = priceToUnits(price);

  // One ticket as the Desk would store it, plus today's settlement amount and coin value as the
  // app would read them. `openedAt` is the price then, relative to today's.
  const ticket = (id, { down, leverageBps, termDays, openedDaysAgo, openedAt, status = 1 }) => {
    const downPayment = BigInt(down) * USDC;
    const total = cost(downPayment, leverageBps);
    const financed = total - downPayment;
    const rateBps =
      DESK_DEFAULTS.baseRateBps + (leverageBps > DESK_DEFAULTS.surchargeAboveBps ? DESK_DEFAULTS.surchargeBps : 0n);
    const term = BigInt(termDays) * DAY;
    const opened = nowS - BigInt(openedDaysAgo) * DAY;
    const qty = quantityAt(total, priceToUnits(price * openedAt), coinDecimals);
    const fixedMarkup = markup(financed, rateBps, term);
    const live = status === 1;
    return {
      id: BigInt(id),
      owner: "sample",
      status,
      opened,
      due: opened + term,
      qty,
      cost: total,
      downPayment,
      financed,
      markup: fixedMarkup,
      repaid: 0n,
      principalRepaid: 0n,
      settle: live ? settlement(financed, fixedMarkup, 0n, opened, opened + term, nowS) : undefined,
      value: live ? valueAt(qty, priceUnits, coinDecimals) : undefined,
    };
  };

  // The weekly cut-off: the coming Friday at 00:00 UTC.
  const today = new Date(now * 1000);
  const daysToFriday = (5 - today.getUTCDay() + 7) % 7 || 7;
  const nextCutoff = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysToFriday) / 1000;

  return {
    bucket: {
      idle: 176_320n * USDC,
      lent: 636_080n * USDC,
      reserve: 6_118_520_000n,
      lastPrice: 1_004_213_000_000_000_000n,
      nextCutoff: BigInt(nextCutoff),
    },
    depositor: { shares: 0n, queuedDeposit: 0n, queuedWithdraw: 0n },
    tickets: [
      ticket(41, { down: 1_000, leverageBps: 20_000n, termDays: 14, openedDaysAgo: 5, openedAt: 0.97 }),
      ticket(38, { down: 2_500, leverageBps: 15_000n, termDays: 7, openedDaysAgo: 3, openedAt: 1.03 }),
      ticket(27, { down: 500, leverageBps: 20_000n, termDays: 7, openedDaysAgo: 12, openedAt: 0.99, status: 2 }),
    ],
    fund: {
      totalStaked: 12_500_000n * SCR,
      totalShares: 12_500_000n * SCR,
      available: 48_212_300_000n,
      periodFinish: nowS + 61n * DAY,
    },
    staker: { stake: 0n, shares: 0n, earned: 0n, request: { shares: 0n, readyAt: 0n } },
    sale: {
      open: true,
      paused: false,
      price: 112_000n, // 0.112 USDC per SCR
      marketPrice: 116_700n,
      reserveValue: 41_000n,
      remaining: 500_000n * SCR,
      reserveAssets: 381_400n * USDC,
      reserveTarget: 812_400n * USDC,
    },
  };
}
