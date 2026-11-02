import { BORROW, EXECUTION, LAUNCH_TIER, SIFT, TERM_DAYS, YEAR_DAYS } from "./params";

// The arithmetic behind every proposed quote on the site, in plain numbers because these are
// illustrations and not transaction amounts. The tests pin the worked examples the docs quote.

// A Trade position: the trader's contribution and the vault's financing buy the asset together.
// `priceRoom` is the fall in the asset's price before the first partial sale: the asset arrives
// net of the entry cost, and the trigger is measured against the full remaining debt.
export function tradeQuote({ contribution, tier = LAUNCH_TIER }) {
  const exposure = contribution * tier.leverage;
  const financing = exposure - contribution;
  const markup = (financing * tier.apr * TERM_DAYS) / YEAR_DAYS;
  const execution = (exposure * (EXECUTION.entryBps + EXECUTION.exitBps)) / 10_000 + EXECUTION.fixedRoundTrip;
  const debt = financing + markup;
  const assetValue = exposure * (1 - EXECUTION.entryBps / 10_000);
  const priceRoom = 1 - (tier.trigger * debt) / assetValue;
  return { contribution, exposure, financing, markup, execution, totalCost: markup + execution, debt, priceRoom, tier };
}

// The asset sold at the trigger to restore cover, before sale costs and any approved rebate.
// Proceeds retire debt one for one, so (A - x) / (D - x) = restore.
export function partialSale({ debt, trigger, restore }) {
  const asset = trigger * debt;
  const sold = ((restore - trigger) * debt) / (restore - 1);
  return { asset, sold, assetAfter: asset - sold, debtAfter: debt - sold, equityAfter: asset - debt };
}

// A trader's new financing: bounded by what is left of the ceiling and by fresh capital.
export function newFinancing({ ceiling, outstanding = 0, pending = 0, freshCapital, leverage = LAUNCH_TIER.leverage }) {
  const headroom = Math.max(0, ceiling - outstanding - pending);
  const capitalBound = (leverage - 1) * freshCapital;
  return { headroom, capitalBound, financing: Math.min(headroom, capitalBound), binding: capitalBound < headroom ? "capital" : "ceiling" };
}

// The ceiling earned after `q` qualifying funded days, from the published table.
export const siftCeiling = (q) => SIFT.schedule[Math.min(Math.max(0, q), SIFT.schedule.length - 1)];

// What an account can actually use: the curve, capped by the account limit and by the vault.
export const effectiveCeiling = ({ q, nav }) => Math.min(siftCeiling(q), SIFT.accountCap, SIFT.navCap * nav);

// A Borrow sale at the reference price. Debt is fixed at the sale; settling early pays only for
// the days used under the proposed binding rebate.
export function borrowQuote({ collateral, ltv = BORROW.entryLtv, apr = BORROW.referenceApr, days = BORROW.termDays }) {
  const usdc = collateral * ltv;
  const markup = (usdc * apr * days) / YEAR_DAYS;
  const debt = usdc + markup;
  const triggerValue = debt / BORROW.liquidationLtv;
  return { collateral, usdc, markup, debt, triggerValue, priceRoom: 1 - triggerValue / collateral, debtLtv: debt / collateral };
}

export function earlySettlement({ usdc, apr = BORROW.referenceApr, term = BORROW.termDays, day }) {
  const settle = usdc * (1 + (apr * Math.min(day, term)) / YEAR_DAYS);
  const rebate = (usdc * apr * Math.max(term - day, 0)) / YEAR_DAYS;
  return { settle, rebate };
}

// Reinvested every `days`: the illustration behind every APY shown, not a payout promise.
export const apy = (apr, days = TERM_DAYS) => (1 + (apr * days) / YEAR_DAYS) ** (YEAR_DAYS / days) - 1;

export const usd = (n, digits = 2) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const pct = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;
