// Mirrors contracts/src/TicketMath.sol exactly, in BigInt, so the order form shows the
// same numbers the contract will record. All amounts are USDC units (6 decimals).

export const BPS = 10_000n;
export const YEAR = 365n * 86_400n;
export const DAY = 86_400n;
export const PROFIT_SHARE_BPS = 3_000n;

export const cost = (downPayment, leverageBps) => (downPayment * leverageBps) / BPS;

export const markup = (financed, rateBps, term) => (financed * rateBps * term) / (BPS * YEAR);

export function earned(markup_, opened, due, now) {
  const term = due - opened;
  let elapsed = now > opened ? now - opened : 0n;
  if (elapsed < DAY) elapsed = DAY;
  if (elapsed > term) elapsed = term;
  return (markup_ * elapsed) / term;
}

export const settlement = (financed, markup_, repaid, opened, due, now) =>
  financed + earned(markup_, opened, due, now) - repaid;

export function profitShare(takesOut, paidIn, shareBps = PROFIT_SHARE_BPS) {
  if (takesOut <= paidIn) return 0n;
  return ((takesOut - paidIn) * shareBps) / BPS;
}

// What the order form shows before a ticket opens.
export function quote({ downPayment, leverageBps, termDays, baseRateBps, surchargeBps, surchargeAboveBps }) {
  const rateBps = baseRateBps + (leverageBps > surchargeAboveBps ? surchargeBps : 0n);
  const total = cost(downPayment, leverageBps);
  const financed = total - downPayment;
  const fixedMarkup = markup(financed, rateBps, BigInt(termDays) * DAY);
  return { cost: total, financed, markup: fixedMarkup, balance: financed + fixedMarkup, rateBps };
}

// What the trader would walk away with if the coin were sold for `coinValue` now.
export function exitPreview({ coinValue, settlementAmount, paidIn }) {
  if (coinValue < settlementAmount) return { canClose: false, toTrader: 0n, toFund: 0n, profit: 0n };
  const surplus = coinValue - settlementAmount;
  const toFund = profitShare(surplus, paidIn);
  return { canClose: true, toTrader: surplus - toFund, toFund, profit: surplus > paidIn ? surplus - paidIn : 0n };
}

export function formatUsdc(units, digits = 2) {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const scale = 10n ** BigInt(6 - digits);
  const rounded = (abs + scale / 2n) / scale;
  const whole = rounded / 10n ** BigInt(digits);
  const frac = (rounded % 10n ** BigInt(digits)).toString().padStart(digits, "0");
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}.${frac}`;
}

export function parseUsdc(text) {
  const clean = String(text).trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(clean) || clean === "" || clean === ".") return null;
  const [whole, frac = ""] = clean.split(".");
  if (frac.length > 6) return null;
  return BigInt(whole || "0") * 1_000_000n + BigInt(frac.padEnd(6, "0"));
}
