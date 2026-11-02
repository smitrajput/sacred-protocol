// The earlier term-mode Desk's defaults and the leverage ceilings offered per asset, for the demo
// app's preview where the contracts cannot be read. The code deployed on Arbitrum One
// (contracts/src/Desk.sol) carries the first design's dials. The current proposed parameters are
// in lib/params.js.

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
