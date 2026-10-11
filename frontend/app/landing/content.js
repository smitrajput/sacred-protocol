// All copy for the landing page, in one place. Mechanism figures come from the equilibrium
// review's final mechanism, which targets a 9% payout; the docs describe version one as
// deployed. Edit here, not in the components.

export const links = {
  app: "/app",
  docs: "/docs",
  waitlist: "#waitlist",
  lightpaper: "/sacred-lightpaper.pdf",
};

// The coin in the worked ticket. Its leverage ceiling comes from lib/defaults.js.
export const exampleCoin = "BTC";

export const nav = [
  { label: "Why", href: "#why" },
  { label: "Yield", href: "#yield" },
  { label: "Leverage", href: "#leverage" },
  { label: "Shariah", href: "#shariah" },
  { label: "Safety", href: "#safety" },
  { label: "Docs", href: links.docs },
];

// The two numbers the hero promises. The mechanism below is cut for a 9% payout today and will
// be re-cut for 11%; change `proposed.targetPayout` when it is.
export const headline = { yield: "11%", leverage: "5x" };

// The proposed launch parameters, from the final mechanism. Shaped like the Desk's defaults so
// the worked ticket can use the same arithmetic as the app.
export const proposed = {
  baseRateBps: 1_550n, // markup 15.5% a year while the bucket is at or under 85% financed
  surchargeBps: 150n, // plus a 1.5% gap premium on 3x term tickets
  surchargeAboveBps: 20_000n,
  minDownPayment: 100_000_000n, // 100 USDC
  profitShareBps: 1_000n, // 10% of net profit
  targetPayout: "9%",
};

// ---- Why: the problem on each side, and the answer ----

export const why = {
  heading: "Both sides of the market were closed to Muslims.",
  lead:
    "Every stablecoin yield is interest on a loan. Every leveraged trade is a loan with a liquidation price. Sacred replaces the loan with a sale, and both sides open.",
  columns: [
    {
      who: "If you hold stablecoins",
      figure: headline.yield,
      unit: "a year, in USDC",
      problem: "Aave, Compound and every lending pool pay interest. So your USDC sits at 0%.",
      answer:
        "Your USDC buys real coins that traders buy from the vault at a fixed markup. The markup is your yield. Until a trader needs it, your USDC waits in a stablecoin pool, never idle.",
    },
    {
      who: "If you trade",
      figure: headline.leverage,
      unit: "on BTC and ETH",
      problem: "Perps charge funding, margin accounts charge interest, and both sell you out at 3am.",
      answer:
        "Buy the coin on credit at a price fixed once. In term mode nothing sells it before the due date, and your loss stops at the down payment.",
    },
    {
      who: "Either way",
      figure: "0",
      unit: "loans, anywhere",
      problem: "DeFi lends. Lending at a rate is riba, however it is dressed up.",
      answer:
        "Sacred sells. The vault owns the coin before it sells it, the price never changes after the sale, and no balance ever grows.",
    },
  ],
};

// ---- Yield: how a deposit becomes markup ----

export const flow = [
  {
    title: "You deposit",
    text: "USDC goes into a bucket. One bucket per coin: BTC, ETH. Buckets never share cash or losses.",
  },
  {
    title: "It waits in a pool",
    text: "Idle USDC, deposits and the protocol's reserve alike, sits in a stablecoin pool by default. It leaves only as traders need it.",
  },
  {
    title: "A trader opens a ticket",
    text: "The bucket pulls USDC from the pool, buys the coin on the spot market and sells it to the trader at cost plus a fixed markup. One transaction.",
  },
  {
    title: "The ticket ends",
    text: "The trader pays the balance by the due date, or the coin is sold on the market. The bucket gets back what it financed, plus the markup.",
  },
  {
    title: "The markup is split",
    text: "85% to depositors, 10% to the manager, 5% to the bucket's loss reserve. Nothing else is charged to anyone.",
  },
];

export const dials = [
  {
    name: "Markup",
    value: "15.5% a year",
    note: "while the bucket is under 85% financed, rising to 30% at the 92% cap. Plus 1.5% on 3x term tickets.",
  },
  {
    name: "Payout",
    value: `${proposed.targetPayout} a year, target`,
    note: "Months above it fill a payout reserve, up to 6% of deposits. Months below it draw on the reserve.",
  },
  {
    name: "Deposits",
    value: "Admitted on demand",
    note: "New deposits only while more than 85% of the bucket is financed, at most 5% growth a week. Idle USDC is returned if utilisation stays under 70% for 28 days.",
  },
  {
    name: "Withdrawals",
    value: "Instant",
    note: "against idle cash while no ticket's cover is under 110%. Otherwise a weekly queue, in time order.",
  },
];

// ---- Leverage: how a ticket works, from the trader's side ----

export const traderSteps = [
  "Pick a coin, a down payment, a leverage and a term.",
  "The bucket buys the coin and sells it to you at cost plus a markup fixed for the whole term. One transaction, and the vault owns the coin before it sells it.",
  "The coin sits pledged in your ticket. Close, pay off or part-pay whenever you like; you pay only for the days used.",
  "At the due date the coin is sold. You get everything above the balance, less 10% of net profit. Below the balance, you lose the down payment and owe nothing more.",
];

export const modes = {
  columns: ["", "Term", "Margin"],
  rows: [
    ["Leverage", "BTC 3x, ETH 2x", "3x to 5x on BTC and ETH"],
    ["Length", "7 or 14 days", "Up to 30 days"],
    ["Early sale", "Never. There is no liquidation price.", "Part of the coin is sold if cover falls to 110%, enough to restore 115%."],
    ["Who carries a crash", "The bucket", "Mostly you"],
    ["Status", "Built, on Arbitrum One", "Built, switched on when the Shariah board rules"],
  ],
};

// ---- Shariah ----

export const contracts = [
  {
    name: "Mudarabah",
    between: "Depositors and the manager",
    line: "Depositors fund, the manager runs the desk, profit is shared by a fixed ratio, nothing is guaranteed.",
  },
  {
    name: "Murabaha",
    between: "The vault and the trader",
    line: "A sale at disclosed cost plus a fixed markup, paid later.",
  },
  {
    name: "Rahn",
    between: "The trader and the vault",
    line: "The coin is pledged until the balance is paid.",
  },
];

export const ruling = [
  { objection: "Fees for delay are riba", answer: "The price is fixed once. Nothing ever grows." },
  { objection: "A loan tied to a sale", answer: "There is no loan. The financing is the sale." },
  { objection: "Selling what is not owned", answer: "Real coins, owned by the vault before it sells them." },
  { objection: "Excessive risk", answer: "Low leverage, and a loss capped at the pledge." },
];

// ---- Safety: the layers, in the order a loss meets them ----

export const layers = [
  {
    name: "The trader's down payment",
    what: "It is inside the coin's value. The first third of a fall on a 3x ticket is the trader's.",
  },
  {
    name: "The bucket's loss reserve",
    what: "A bucket is one coin's pool of depositors' USDC. 5% of every markup stays in it as a reserve, until the reserve holds 3% of deposits.",
  },
  {
    name: "The backstop fund",
    what: "USDC fed by the traders' 10% profit share. It holds 8% of everything financed before stakers see a cent of it.",
  },
  {
    name: "Staked SCR",
    what: "The protocol's token, staked by people who are paid from the fund's excess. Counted as zero when solvency is tested.",
  },
  {
    name: "The depositors of that bucket",
    what: "In proportion, through the share price. The manager's own deposit loses with them. No other bucket is touched.",
  },
];

export const backtests = {
  columns: ["Ticket", "Average loss a year", "Worst year"],
  rows: [
    ["Term, BTC 3x, 14 days", "1.0%", "5.1% (2020)"],
    ["Term, ETH 2x, 14 days", "0.0%", "0.0%"],
  ],
  note:
    "Binance one-minute prices, January 2020 to August 2026, tickets left unmanaged. Losses are a share of the amount financed, against a markup of 15.5% to 17% a year. On-chain markets are thinner than Binance, so treat these as a floor. The past does not bound the future.",
};

export const system = {
  columns: ["Whole system, 1,000 five-year paths", "Result"],
  rows: [
    [
      "Term mode, BTC 3x and ETH 2x, the proposed economics",
      "Payout at or above 9% in every month. Depositors lose in 0.02% of years; worst year 0.5%.",
    ],
    ["A 60-minute outage on every forced sale", "Payout unchanged. Depositors lose in 1.5% of years; worst year 7.1%."],
  ],
};
