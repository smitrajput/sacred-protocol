// The Desk's launch defaults and the leverage ceilings offered per asset. Used wherever the
// contracts cannot be read: the landing page's worked position and the app's preview. The code
// deployed on Arbitrum One (contracts/src/Desk.sol) still carries the first design's dials,
// 10% plus 1% above 2x; the launch re-cut is on the docs' economics page.

export const DESK_DEFAULTS = {
  baseRateBps: 1_550n, // 15.5% a year while the bucket is at or under 85% financed
  surchargeBps: 150n, // plus a 1.5% gap premium
  surchargeAboveBps: 20_000n, // on term positions above 2x
  minDownPayment: 100_000_000n, // 100 USDC
};

export const MAX_LEVERAGE_BPS = { BTC: 30_000n, ETH: 30_000n };

// The leverage choices a form offers, up to the asset's ceiling.
const LEVERAGE_STEPS = [15_000n, 20_000n, 25_000n, 30_000n];
export const leverageOptions = (maxBps) => LEVERAGE_STEPS.filter((bps) => bps <= maxBps);
export const leverageLabel = (bps) => `${Number(bps) / 10_000}x`;
