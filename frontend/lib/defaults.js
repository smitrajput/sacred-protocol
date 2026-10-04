// The Desk's proposed defaults (contracts/src/Desk.sol) and the leverage ceilings offered per
// coin. Used wherever the contracts cannot be read: the landing page's worked ticket and the
// app's preview.

export const DESK_DEFAULTS = {
  baseRateBps: 1_000n, // 10% a year
  surchargeBps: 100n, // plus 1% a year
  surchargeAboveBps: 20_000n, // on tickets above 2x
  minDownPayment: 100_000_000n, // 100 USDC
};

export const MAX_LEVERAGE_BPS = { BTC: 30_000n, ETH: 30_000n };

// The leverage choices a form offers, up to the coin's ceiling.
const LEVERAGE_STEPS = [15_000n, 20_000n, 25_000n, 30_000n];
export const leverageOptions = (maxBps) => LEVERAGE_STEPS.filter((bps) => bps <= maxBps);
export const leverageLabel = (bps) => `${Number(bps) / 10_000}x`;
