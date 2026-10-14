// A simulated chain for the demo: the Vault and the Desk as contracts/src/Vault.sol and Desk.sol
// write them, the USDC and MON balances they move, a price feed and a market that trades at the
// feed's price. Amounts are BigInt in token units, times are seconds, exactly as on chain. The
// arithmetic is the app's own (lib/math.js), so every figure matches what the contracts would
// record. Nothing here touches a network.
//
// Each transaction runs on a copy of the state and is committed only if it returns, so a refused
// action changes nothing, as a reverted transaction would. The presenter's controls move the
// price and the clock, which is what a public testnet cannot do on demand.

import { DESK_DEFAULTS } from "./defaults.js";
import { BPS, DAY, PROFIT_SHARE_BPS, cost as costOf, markup as markupOf, profitShare, settlement } from "./math.js";

export const USDC = 1_000_000n;
export const MON = 10n ** 18n;
const WAD = 10n ** 18n;

export const ME = "0x7a3F9c2E5b1D4e8A6c0F3b9D2e7A1c4F8b6D3e21";
const OTHERS = "0x51C0b2e7A9d4F3c8E6a1B0d5C9e2F7a4b8D3c6E0";
const KEEPER = "0x9e4A7d1C3b8F2e6D0a5C9b4E7f1A3d8C2e6B0f59";

export const LIVE = 1;
const CLOSED = 2;
const PAID_OFF = 3;
const SETTLED = 4;
const SETTLED_SHORT = 5;

// The demo's starting point. MON opens at 0.025 USDC, so 2,000 USDC buys 80,000 MON.
export const START_PRICE = 25_000n; // USDC units per whole MON
const WALLET_USDC = 25_000n * USDC;

const PARAMS = {
  ...DESK_DEFAULTS,
  maxLeverageBps: 20_000n,
  maxCost: 100_000n * USDC,
  saleToleranceBps: 100n,
  keeperFee: 1n * USDC,
  bucketCap: 2_000_000n * USDC,
  utilCapBps: 8_500n,
  reserveSliceBps: 1_000n,
  reserveTargetBps: 500n,
  period: 7n * DAY,
};
const TERMS = [7n * DAY, 14n * DAY];

const min = (a, b) => (a < b ? a : b);

class Refused extends Error {}
const refuse = (message) => {
  throw new Refused(message);
};

// ───────────────────────── State ─────────────────────────

function emptyState(now) {
  return {
    now,
    price: START_PRICE,
    usdc: {}, // address => balance
    mon: {},
    allowance: {}, // `${owner}:${spender}` => amount
    vault: {
      idle: 0n,
      lent: 0n,
      reserve: 0n,
      queuedDeposits: 0n,
      claimable: 0n,
      epoch: 1n,
      nextCutoff: now,
      lastNav: 0n,
      lastPrice: WAD,
      supply: 0n,
      shares: {}, // address => shares, the vault's own (queued withdrawals, unclaimed deposits) under "vault"
      epochs: {},
      depositOf: {},
      withdrawOf: {},
    },
    desk: { nextId: 1n, positions: {}, owed: {} },
    fund: { available: 48_212_300_000n, received: 0n },
  };
}

const bal = (book, who) => book[who] ?? 0n;
const epochOf = (v, n) => (v.epochs[n] ??= { depAssets: 0n, depShares: 0n, wdShares: 0n, wdBurned: 0n, wdAssets: 0n });

function pull(s, from, spender, amount) {
  if (bal(s.usdc, from) < amount) refuse("Your wallet does not hold enough USDC.");
  const key = `${from}:${spender}`;
  if ((s.allowance[key] ?? 0n) < amount) refuse("USDC is not approved for this.");
  s.allowance[key] -= amount;
  s.usdc[from] = bal(s.usdc, from) - amount;
}
const give = (book, to, amount) => (book[to] = bal(book, to) + amount);
const moveShares = (v, from, to, amount) => {
  if (bal(v.shares, from) < amount) refuse("You do not hold that many shares.");
  v.shares[from] -= amount;
  give(v.shares, to, amount);
};

// ───────────────────────── The oracle and the market ─────────────────────────

const valueOf = (s, qty) => (qty * s.price) / MON; // Oracle.value
const quantityOf = (s, usdcAmount) => (usdcAmount * MON) / s.price; // Oracle.quantity
// The market fills at the feed's price, so the desk's slippage floors always hold.
const sell = valueOf;
const buy = quantityOf;

// ───────────────────────── Vault ─────────────────────────

function navNow(s) {
  const { book, shortfall } = bookValue(s);
  return s.vault.idle + book + min(s.vault.reserve, shortfall);
}

function requestDeposit(s, user, assets) {
  const v = s.vault;
  if (assets === 0n) refuse("Enter an amount.");
  claimDeposit(s, user);
  if (v.lastNav + v.queuedDeposits + assets > PARAMS.bucketCap) refuse("The bucket is full.");
  pull(s, user, "vault", assets);
  v.queuedDeposits += assets;
  epochOf(v, v.epoch).depAssets += assets;
  v.depositOf[user] = { amount: (v.depositOf[user]?.amount ?? 0n) + assets, epoch: v.epoch };
  return `${fmt(assets)} USDC queued for the cut-off`;
}

function requestWithdraw(s, user, shares) {
  const v = s.vault;
  if (shares === 0n) refuse("Enter an amount.");
  claimWithdraw(s, user);
  moveShares(v, user, "vault", shares);
  epochOf(v, v.epoch).wdShares += shares;
  v.withdrawOf[user] = { amount: (v.withdrawOf[user]?.amount ?? 0n) + shares, epoch: v.epoch };
  return `${fmt(shares)} shares queued for the cut-off`;
}

function claimDeposit(s, user) {
  const v = s.vault;
  const r = v.depositOf[user];
  if (!r || r.amount === 0n || r.epoch >= v.epoch) return "Nothing to claim yet";
  delete v.depositOf[user];
  const e = epochOf(v, r.epoch);
  if (e.depShares === 0n) {
    v.claimable -= r.amount;
    give(s.usdc, user, r.amount);
    return `${fmt(r.amount)} USDC returned`;
  }
  const shares = (r.amount * e.depShares) / e.depAssets;
  moveShares(v, "vault", user, shares);
  return `${fmt(shares)} shares to your wallet`;
}

function claimWithdraw(s, user) {
  const v = s.vault;
  const r = v.withdrawOf[user];
  if (!r || r.amount === 0n || r.epoch >= v.epoch) return "Nothing to claim yet";
  delete v.withdrawOf[user];
  const e = epochOf(v, r.epoch);
  const assets = (r.amount * e.wdAssets) / e.wdShares;
  const sharesBack = (r.amount * (e.wdShares - e.wdBurned)) / e.wdShares;
  if (sharesBack > 0n) moveShares(v, "vault", user, sharesBack);
  if (assets > 0n) {
    v.claimable -= assets;
    give(s.usdc, user, assets);
  }
  return `${fmt(assets)} USDC to your wallet${sharesBack > 0n ? `, ${fmt(sharesBack)} shares back` : ""}`;
}

function cutoff(s) {
  const v = s.vault;
  if (s.now < v.nextCutoff) refuse("The cut-off is not due yet.");
  const e = epochOf(v, v.epoch);
  const nav = navNow(s);
  const price = v.supply === 0n ? WAD : (nav * WAD) / v.supply;

  const dep = e.depAssets;
  if (dep > 0n) {
    v.queuedDeposits -= dep;
    const shares = price === 0n ? 0n : (dep * WAD) / price;
    if (shares === 0n) v.claimable += dep;
    else {
      v.idle += dep;
      e.depShares = shares;
      v.supply += shares;
      give(v.shares, "vault", shares);
    }
  }

  let assetsOut = 0n;
  if (e.wdShares > 0n) {
    const need = (e.wdShares * price) / WAD;
    const burned = need <= v.idle ? e.wdShares : (e.wdShares * v.idle) / need;
    assetsOut = (burned * price) / WAD;
    v.idle -= assetsOut;
    v.claimable += assetsOut;
    e.wdBurned = burned;
    e.wdAssets = assetsOut;
    v.shares.vault -= burned;
    v.supply -= burned;
  }

  v.lastNav = nav + (e.depShares > 0n ? dep : 0n) - assetsOut;
  v.lastPrice = price;
  v.epoch += 1n;
  v.nextCutoff += PARAMS.period;
  if (v.nextCutoff <= s.now) v.nextCutoff = s.now + PARAMS.period;
  return `Cut-off: shares priced at ${(Number(price) / 1e18).toFixed(6)} USDC`;
}

function lend(s, amount) {
  const v = s.vault;
  if (amount > v.idle) refuse("The bucket does not have the free cash for this position.");
  v.idle -= amount;
  v.lent += amount;
}

function repay(s, principal, markup) {
  const v = s.vault;
  v.lent -= principal;
  let slice = 0n;
  const target = ((v.idle + v.lent) * PARAMS.reserveTargetBps) / BPS;
  if (v.reserve < target) {
    slice = (markup * PARAMS.reserveSliceBps) / BPS;
    if (slice > target - v.reserve) slice = target - v.reserve;
  }
  v.reserve += slice;
  v.idle += principal + markup - slice;
}

// The loss reserve pays first, then the backstop fund; whatever is left lowers the share price.
function writeOff(s, principal) {
  const v = s.vault;
  v.lent -= principal;
  const fromReserve = min(principal, v.reserve);
  v.reserve -= fromReserve;
  v.idle += fromReserve;
  const fromFund = min(principal - fromReserve, s.fund.available);
  s.fund.available -= fromFund;
  v.idle += fromFund;
}

function assertHealthy(s) {
  const v = s.vault;
  if (v.lent * BPS > PARAMS.utilCapBps * (v.idle + v.lent)) refuse("The bucket is too heavily financed to fund this position.");
  if (v.idle < (epochOf(v, v.epoch).wdShares * v.lastPrice) / WAD) refuse("The bucket's cash is set aside for withdrawals.");
}

// ───────────────────────── Desk ─────────────────────────

const rateBps = (leverageBps) => PARAMS.baseRateBps + (leverageBps > PARAMS.surchargeAboveBps ? PARAMS.surchargeBps : 0n);
const settlementAmount = (s, t) => settlement(t.financed, t.markup, t.repaid, t.opened, t.due, s.now);
const liveOf = (s) => Object.values(s.desk.positions).filter((t) => t.status === LIVE);

function bookValue(s) {
  let book = 0n;
  let shortfall = 0n;
  for (const t of liveOf(s)) {
    const due = settlementAmount(s, t);
    const value = valueOf(s, t.qty);
    if (value < due) {
      book += value;
      shortfall += due - value;
    } else book += due;
  }
  return { book, shortfall };
}

function open(s, user, downPayment, leverageBps, term, minAssetOut) {
  if (leverageBps <= BPS || leverageBps > PARAMS.maxLeverageBps) refuse("That leverage is not offered for MON.");
  if (!TERMS.includes(term)) refuse("Terms are 7 or 14 days.");
  if (downPayment < PARAMS.minDownPayment) refuse("The down payment must be at least 100 USDC.");
  const total = costOf(downPayment, leverageBps);
  if (total > PARAMS.maxCost) refuse("That position is above the desk's size limit.");
  const financed = total - downPayment;

  lend(s, total);
  const floorQty = (quantityOf(s, total) * (BPS - PARAMS.saleToleranceBps)) / BPS;
  const qty = buy(s, total);
  if (qty < (minAssetOut > floorQty ? minAssetOut : floorQty)) refuse("The price moved past your limit.");

  pull(s, user, "desk", downPayment);
  repay(s, downPayment, 0n);
  assertHealthy(s);

  const id = s.desk.nextId++;
  s.desk.positions[id] = {
    id,
    owner: user,
    status: LIVE,
    opened: s.now,
    due: s.now + term,
    qty,
    cost: total,
    downPayment,
    financed,
    markup: markupOf(financed, rateBps(leverageBps), term),
    repaid: 0n,
    principalRepaid: 0n,
  };
  return `Position ${id} opened: ${fmtMon(qty)} MON pledged for you`;
}

function liveOwned(s, user, id) {
  const t = s.desk.positions[id];
  if (!t || t.status !== LIVE) refuse("That position is no longer live.");
  if (t.owner !== user) refuse("That position is not yours.");
  return t;
}

function payVault(s, t, amount) {
  const principalLeft = t.financed - t.principalRepaid;
  const principal = min(amount, principalLeft);
  repay(s, principal, amount - principal);
  if (principal < principalLeft) writeOff(s, principalLeft - principal);
  t.principalRepaid = t.financed;
}

function toFund(s, share) {
  s.fund.available += share;
  s.fund.received += share;
}

function end(t, status) {
  t.status = status;
  t.qty = 0n;
}

function close(s, user, id) {
  const t = liveOwned(s, user, id);
  const due = settlementAmount(s, t);
  const proceeds = sell(s, t.qty);
  if (proceeds < due) refuse("Selling now would not cover what you owe. The position stays open until its due date.");
  payVault(s, t, due);
  const surplus = proceeds - due;
  const share = profitShare(surplus, t.downPayment + t.repaid, PROFIT_SHARE_BPS);
  toFund(s, share);
  end(t, CLOSED);
  give(s.usdc, user, surplus - share);
  return `Position ${id} closed: ${fmt(surplus - share)} USDC to your wallet${share > 0n ? `, ${fmt(share)} to the backstop fund` : ""}`;
}

function payOff(s, user, id) {
  const t = liveOwned(s, user, id);
  const due = settlementAmount(s, t);
  const assetValue = valueOf(s, t.qty);
  const share = profitShare(assetValue > due ? assetValue - due : 0n, t.downPayment + t.repaid, PROFIT_SHARE_BPS);
  pull(s, user, "desk", due + share);
  payVault(s, t, due);
  toFund(s, share);
  const qty = t.qty;
  end(t, PAID_OFF);
  give(s.mon, user, qty);
  return `Position ${id} paid off with ${fmt(due + share)} USDC: ${fmtMon(qty)} MON to your wallet`;
}

function partPay(s, user, id, amount) {
  const t = liveOwned(s, user, id);
  if (amount === 0n || amount >= settlementAmount(s, t)) refuse("A part payment must be less than the amount to settle.");
  pull(s, user, "desk", amount);
  const principalLeft = t.financed - t.principalRepaid;
  const principal = min(amount, principalLeft);
  t.repaid += amount;
  t.principalRepaid += principal;
  repay(s, principal, amount - principal);
  return `${fmt(amount)} USDC paid towards position ${id}`;
}

function settle(s, keeper, id) {
  const t = s.desk.positions[id];
  if (!t || t.status !== LIVE) refuse("That position is no longer live.");
  if (s.now <= t.due) refuse("The position is not due yet.");
  const proceeds = sell(s, t.qty);
  const fee = min(PARAMS.keeperFee, proceeds);
  const net = proceeds - fee;
  const balance = t.financed + t.markup - t.repaid;
  let note;
  if (net >= balance) {
    payVault(s, t, balance);
    const surplus = net - balance;
    const share = profitShare(surplus, t.downPayment + t.repaid, PROFIT_SHARE_BPS);
    toFund(s, share);
    give(s.desk.owed, t.owner, surplus - share);
    end(t, SETTLED);
    note = `Position ${id} settled: ${fmt(surplus - share)} USDC waiting for its owner`;
  } else {
    const principalLeft = t.financed - t.principalRepaid;
    payVault(s, t, net);
    end(t, SETTLED_SHORT);
    note = `Position ${id} settled short: ${fmt(principalLeft > net ? principalLeft - net : 0n)} USDC written off against the loss reserve and the backstop fund; the trader owes nothing`;
  }
  give(s.usdc, keeper, fee);
  return note;
}

function claimOwed(s, user) {
  const amount = bal(s.desk.owed, user);
  s.desk.owed[user] = 0n;
  give(s.usdc, user, amount);
  return `${fmt(amount)} USDC collected`;
}

// ───────────────────────── Dispatch ─────────────────────────

const HANDLERS = {
  "usdc.approve": (s, from, [spender, amount]) => {
    s.allowance[`${from}:${spender}`] = amount;
    return `USDC approved for the ${spender}`;
  },
  "vault.requestDeposit": (s, from, [assets]) => requestDeposit(s, from, assets),
  "vault.requestWithdraw": (s, from, [shares]) => requestWithdraw(s, from, shares),
  "vault.claimDeposit": (s, _from, [user]) => claimDeposit(s, user),
  "vault.claimWithdraw": (s, _from, [user]) => claimWithdraw(s, user),
  "vault.cutoff": (s) => cutoff(s),
  "desk.open": (s, from, [down, leverage, term, minOut]) => open(s, from, down, leverage, term, minOut),
  "desk.close": (s, from, [id]) => close(s, from, id),
  "desk.payOff": (s, from, [id]) => payOff(s, from, id),
  "desk.partPay": (s, from, [id, amount]) => partPay(s, from, id, amount),
  "desk.settle": (s, from, [id]) => settle(s, from, id),
  "desk.claimOwed": (s, from) => claimOwed(s, from),
};

// Run one call ({ address, functionName, args }) from `from` on a copy; return the new state
// and a one-line receipt, or throw with a plain-words reason.
export function execute(state, call, from = ME) {
  const handler = HANDLERS[`${call.address}.${call.functionName}`];
  if (!handler) throw new Error(`The demo does not simulate ${call.address}.${call.functionName}.`);
  const next = structuredClone(state);
  const receipt = handler(next, from, call.args ?? []);
  return { state: next, receipt };
}

export const isRefusal = (e) => e instanceof Refused;

// ───────────────────────── Reads, in the shapes the app's hooks return ─────────────────────────

export const read = {
  bucket: (s) => ({
    idle: s.vault.idle,
    lent: s.vault.lent,
    reserve: s.vault.reserve,
    lastPrice: s.vault.lastPrice,
    nextCutoff: s.vault.nextCutoff,
  }),
  depositor: (s, who) => ({
    shares: bal(s.vault.shares, who),
    queuedDeposit: s.vault.depositOf[who]?.amount ?? 0n,
    queuedWithdraw: s.vault.withdrawOf[who]?.amount ?? 0n,
  }),
  deskParams: () => ({
    baseRateBps: PARAMS.baseRateBps,
    surchargeBps: PARAMS.surchargeBps,
    surchargeAboveBps: PARAMS.surchargeAboveBps,
    maxLeverageBps: PARAMS.maxLeverageBps,
    minDownPayment: PARAMS.minDownPayment,
  }),
  feedPrice: (s) => valueOf(s, MON),
  fairQuantity: (s, usdcAmount) => quantityOf(s, usdcAmount),
  positions: (s, who) => ({
    positions: Object.values(s.desk.positions)
      .filter((t) => t.owner === who)
      .sort((a, b) => Number(b.id - a.id))
      .map((t) => (t.status === LIVE ? { ...t, settle: settlementAmount(s, t), value: valueOf(s, t.qty) } : t)),
    owed: bal(s.desk.owed, who),
  }),
  wallet: (s, who) => ({
    usdc: bal(s.usdc, who),
    mon: bal(s.mon, who),
    usdcForVault: s.allowance[`${who}:vault`] ?? 0n,
    usdcForDesk: s.allowance[`${who}:desk`] ?? 0n,
  }),
  fund: (s) => ({ ...s.fund }),
  nav: (s) => navNow(s),
  duePositions: (s) => liveOf(s).filter((t) => s.now > t.due),
};

// ───────────────────────── The presenter's controls ─────────────────────────

export const setPrice = (s, price) => ({ ...s, price });
export const advance = (s, seconds) => ({ ...s, now: s.now + seconds });

// Move the clock to the cut-off and run it, as the keeper would.
export function runCutoff(s) {
  const at = s.now < s.vault.nextCutoff ? { ...s, now: s.vault.nextCutoff } : s;
  return execute(at, { address: "vault", functionName: "cutoff" }, KEEPER);
}

// Settle every position past its due date, as the keeper would.
export function settleDue(s) {
  let state = s;
  const receipts = [];
  for (const t of read.duePositions(s)) {
    const r = execute(state, { address: "desk", functionName: "settle", args: [t.id] }, KEEPER);
    state = r.state;
    receipts.push(r.receipt);
  }
  return { state, receipts };
}

// ───────────────────────── The starting point ─────────────────────────

// A bucket with a history: depositors who joined a fortnight ago, a week of positions repaid
// with markup (so the share price is above 1), and four positions of other traders still live.
// Every step goes through the same functions as the demo's own transactions. The demo's clock
// starts at noon UTC today, three days before the next cut-off.
export function initialState(nowMs = Date.now()) {
  const today = Math.floor(nowMs / 86_400_000) * 86_400;
  const now = BigInt(today) + 12n * 3_600n;
  const HOUR = 3_600n;
  let s = emptyState(now - 11n * DAY);
  s.vault.nextCutoff = now - 11n * DAY;
  give(s.usdc, OTHERS, 10_000_000n * USDC);
  s.allowance[`${OTHERS}:vault`] = 10n ** 30n;
  s.allowance[`${OTHERS}:desk`] = 10n ** 30n;

  const tx = (functionName, address, args, from = OTHERS) => (s = execute(s, { address, functionName, args }, from).state);
  const at = (t) => (s = { ...s, now: t });
  const priced = (p) => (s = { ...s, price: p });

  // Week one: 200,000 USDC of deposits, priced at the first cut-off.
  at(now - 12n * DAY);
  tx("requestDeposit", "vault", [200_000n * USDC]);
  at(now - 11n * DAY);
  s = runCutoff(s).state;
  tx("claimDeposit", "vault", [OTHERS]);

  // Week two: other traders take 14-day positions; two are paid off early, with markup.
  at(now - 11n * DAY + HOUR);
  priced(23_800n);
  tx("open", "desk", [45_000n * USDC, 20_000n, 14n * DAY, 0n]);
  tx("open", "desk", [50_000n * USDC, 15_000n, 14n * DAY, 0n]);
  at(now - 5n * DAY);
  priced(24_600n);
  tx("payOff", "desk", [1n]);
  tx("payOff", "desk", [2n]);
  at(now - 4n * DAY);
  s = runCutoff(s).state;

  // Still live: four positions opened over the last four days.
  at(now - 4n * DAY + HOUR);
  priced(24_100n);
  tx("open", "desk", [45_000n * USDC, 20_000n, 14n * DAY, 0n]);
  at(now - 2n * DAY);
  priced(24_700n);
  tx("open", "desk", [40_000n * USDC, 15_000n, 14n * DAY, 0n]);
  at(now - 1n * DAY);
  priced(25_300n);
  tx("open", "desk", [50_000n * USDC, 20_000n, 7n * DAY, 0n]);
  at(now - 1n * DAY + 2n * HOUR);
  tx("open", "desk", [35_000n * USDC, 20_000n, 14n * DAY, 0n]);

  at(now);
  priced(START_PRICE);
  give(s.usdc, ME, WALLET_USDC);
  return s;
}

// ───────────────────────── Formatting for receipts ─────────────────────────

function group(units, decimals, digits) {
  const scale = 10n ** BigInt(decimals - digits);
  const rounded = (units + scale / 2n) / scale;
  const whole = rounded / 10n ** BigInt(digits);
  const frac = (rounded % 10n ** BigInt(digits)).toString().padStart(digits, "0");
  return `${whole.toLocaleString("en-US")}${digits ? `.${frac}` : ""}`;
}
export const fmt = (units) => group(units, 6, 2);
export const fmtMon = (units) => group(units, 18, 2);
