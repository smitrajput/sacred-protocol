// Mirrors the arithmetic of StakedBackstopFund.sol and ReserveSale.sol, in BigInt, so the
// panels show what the contracts will do. SCR has 18 decimals; USDC has 6.

import { DAY, formatAmount } from "./math";

export const SCR = 10n ** 18n;
export const formatScr = (units, digits = 0) => formatAmount(units ?? 0n, 18, digits);
export const COOLDOWN = 14n * DAY;
export const UNSTAKE_WINDOW = 7n * DAY;

const ceilDiv = (a, b) => (a + b - 1n) / b;

// A stake is a share of the staked SCR. The first stake is one share per SCR; later ones get
// shares in proportion. Rounded up so a request to leave covers the whole amount asked for.
export const sharesFor = (amount, totalShares, totalStaked) =>
  totalStaked === 0n ? amount : ceilDiv(amount * totalShares, totalStaked);

export const stakeBehind = (shares, totalShares, totalStaked) =>
  totalShares === 0n ? 0n : (shares * totalStaked) / totalShares;

// Where a staker is on the way out: nothing requested, cooling down, inside the window to take
// the SCR out, or the window missed (the request must be made again).
export function unstakePhase(request, now) {
  if (!request || request.shares === 0n) return { phase: "none" };
  if (now < request.readyAt) return { phase: "cooling", shares: request.shares, until: request.readyAt };
  const closes = request.readyAt + UNSTAKE_WINDOW;
  if (now <= closes) return { phase: "open", shares: request.shares, until: closes };
  return { phase: "missed", shares: request.shares, since: closes };
}

// The reserve sale charges amount x price, rounded up, with the price in USDC per whole SCR.
export const saleCost = (amount, price) => ceilDiv(amount * price, SCR);

// The most a buyer will pay: the quoted cost plus a little room for the average price to move
// before the transaction lands.
export const withSlack = (cost, bps = 100n) => cost + (cost * bps) / 10_000n;
