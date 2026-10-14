// Runs DEMO_SCRIPT.md through the simulated chain and prints the figures each step puts on
// screen, so the script's numbers can be checked against the code: `npm run rehearse`.
// The figures depend only on the clicks, not on the day the demo is recorded.

import { DAY, exitPreview, formatUsdc, quote } from "../lib/math.js";
import { DESK_DEFAULTS } from "../lib/defaults.js";
import { ME, MON, USDC, execute, initialState, read, runCutoff, settleDue } from "../lib/sim.js";

let s = initialState(Date.UTC(2026, 9, 14, 9));
const MAX = 2n ** 256n - 1n;
const send = (address, functionName, ...args) => {
  const r = execute(s, { address, functionName, args });
  s = r.state;
  console.log(`    ✓ ${r.receipt}`);
};
const usd = (x) => formatUsdc(x);
const mon = (x) => (Number(x) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 });
const day = () => new Date(Number(s.now) * 1000).toUTCString().slice(5, 16);
const step = (title) => console.log(`\n${title}`);
const at = () => console.log(`    [${day()}, MON ${(Number(s.price) / 1e6).toFixed(4)}]`);
const price = (p) => (s = { ...s, price: p });
const bucket = () => {
  const b = read.bucket(s);
  const total = b.idle + b.lent;
  console.log(
    `    Earn panel: in the bucket ${usd(total)}, financed ${(Number((b.lent * 10_000n) / total) / 100).toFixed(2)}%, loss reserve ${usd(b.reserve)}, share price ${(Number(b.lastPrice) / 1e18).toFixed(6)}`,
  );
};
const wallet = () => {
  const w = read.wallet(s, ME);
  console.log(`    Wallet: ${usd(w.usdc)} USDC, ${mon(w.mon)} MON`);
};
const positions = () => {
  for (const t of read.positions(s, ME).positions.filter((t) => t.status === 1)) {
    const p = exitPreview({ assetValue: t.value, settlementAmount: t.settle, paidIn: t.downPayment + t.repaid });
    console.log(
      `    Position ${t.id}: ${mon(t.qty)} MON, to settle today ${usd(t.settle)}, worth now ${usd(t.value)}, you would get ${p.canClose ? usd(p.toTrader) : "under water"}`,
    );
  }
};
const order = (down, leverageBps, termDays) => {
  const q = quote({ downPayment: down, leverageBps, termDays, ...DESK_DEFAULTS });
  console.log(
    `    Order form: vault buys for ${usd(q.cost)} = ${mon((q.cost * MON) / s.price)} MON, finances ${usd(q.financed)}, markup ${usd(q.markup)} at ${Number(q.rateBps) / 100}%, owe in ${termDays} days ${usd(q.balance)}`,
  );
};

step("0. Open the page");
at();
bucket();

step("1. Connect, deposit 10,000 USDC");
send("usdc", "approve", "vault", MAX);
send("vault", "requestDeposit", 10_000n * USDC);
wallet();

step("2. Presenter: Run weekly cut-off");
s = runCutoff(s).state;
at();
bucket();

step("3. Claim shares");
send("vault", "claimDeposit", ME);
console.log(`    Your shares ${usd(read.depositor(s, ME).shares)}`);

step("4. Open 1,000 USDC, 2x, 14 days");
order(1_000n * USDC, 20_000n, 14);
send("usdc", "approve", "desk", MAX);
send("desk", "open", 1_000n * USDC, 20_000n, 14n * DAY, 0n);
wallet();

step("5. Presenter: MON +30%");
price(32_500n);
at();
positions();

step("6. Close position 7");
send("desk", "close", 7n);
wallet();

step("7. Presenter: Start price. Open 1,000 USDC, 2x, 7 days");
price(25_000n);
order(1_000n * USDC, 20_000n, 7);
send("desk", "open", 1_000n * USDC, 20_000n, 7n * DAY, 0n);
positions();

step("8. Presenter: +1 day, MON +10%. Part pay 400");
s = { ...s, now: s.now + DAY };
price(27_500n);
at();
positions();
send("desk", "partPay", 8n, 400n * USDC);
positions();

step("9. Pay off position 8");
send("desk", "payOff", 8n);
wallet();

step("10. Presenter: Start price. Open 1,000 USDC, 2x, 14 days");
price(25_000n);
send("desk", "open", 1_000n * USDC, 20_000n, 14n * DAY, 0n);
positions();

step("11. Presenter: set 0.0120 (MON -52%)");
price(12_000n);
at();
positions();
try {
  send("desk", "close", 9n);
} catch (e) {
  console.log(`    Close refused: ${e.message}`);
}
bucket();

const beforeEnding = s;
step("12. Presenter: +15 days, set 0.0300, Settle due positions");
s = { ...s, now: s.now + 15n * DAY };
price(30_000n);
at();
positions();
const r = settleDue(s);
s = r.state;
r.receipts.forEach((x) => console.log(`    ✓ ${x}`));
console.log(`    Waiting to collect: ${usd(read.positions(s, ME).owed)}`);

step("13. Collect");
send("desk", "claimOwed");
wallet();

step("14. Withdraw 9976.15 shares, run cut-off, claim USDC");
send("vault", "requestWithdraw", 9_976_150_000n); // typed as 9976.15: every share but 0.007 of dust
s = runCutoff(s).state;
bucket();
send("vault", "claimWithdraw", ME);
wallet();

step("Alternative 12: stay at 0.0120, +15 days, Settle due positions");
s = { ...beforeEnding, now: beforeEnding.now + 15n * DAY };
at();
positions();
const short = settleDue(s);
s = short.state;
short.receipts.filter((x) => x.startsWith("Position 9 ")).forEach((x) => console.log(`    ✓ ${x}`));
console.log(`    Waiting to collect: ${usd(read.positions(s, ME).owed)}`);
bucket();
console.log(`    Backstop fund: ${usd(read.fund(s).available)} USDC`);
