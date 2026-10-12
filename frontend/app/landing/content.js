// All copy for the landing page, in one place. Mechanism figures are the launch parameters from
// the equilibrium review's final mechanism, cut for a 9% payout; the docs carry the same
// numbers. Edit here, not in the components.

export const links = {
  app: "/app",
  docs: "/docs",
  waitlist: "#waitlist",
  lightpaper: "/sacred-lightpaper.pdf",
};

// The asset in the worked position. Its leverage ceiling comes from lib/defaults.js.
export const exampleAsset = "BTC";

export const nav = [
  { label: "Why", href: "#why" },
  { label: "Yield", href: "#yield" },
  { label: "Leverage", href: "#leverage" },
  { label: "Shariah", href: "#shariah" },
  { label: "Safety", href: "#safety" },
  { label: "Docs", href: links.docs },
];

// The two numbers the hero promises. The payout is the mechanism's target, and the markup
// below is cut for it; the two move together or not at all.
export const headline = { yield: "9%", leverage: "5x" };

// The launch parameters, from the final mechanism. Shaped like the Desk's defaults so the
// worked position can use the same arithmetic as the app.
export const proposed = {
  baseRateBps: 1_550n, // markup 15.5% a year while the vault is at or under 85% financed
  surchargeBps: 150n, // plus a 1.5% gap premium on 3x term positions
  surchargeAboveBps: 20_000n,
  minDownPayment: 100_000_000n, // 100 USDC
  profitShareBps: 1_000n, // 10% of net profit
  targetPayout: headline.yield,
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
        "Your USDC buys real assets, BTC or ETH, that traders buy from the vault at a fixed markup. The markup is your yield. Until a trader needs it, your USDC waits in the vault, never lent.",
    },
    {
      who: "If you trade",
      figure: headline.leverage,
      unit: "on BTC and ETH",
      problem: "Perps charge funding, margin accounts charge interest, and both sell you out at 3am.",
      answer:
        "Buy the asset on credit at a price fixed once. In term mode nothing sells it before the due date, and your loss stops at the down payment.",
    },
    {
      who: "Either way",
      figure: "0",
      unit: "loans, anywhere",
      problem: "DeFi lends. Lending at a rate is riba, however it is dressed up.",
      answer:
        "Sacred sells. The vault owns the asset before it sells it, the price never changes after the sale, and no balance ever grows.",
    },
  ],
};

// ---- Yield: how a deposit becomes markup ----

export const flow = [
  {
    title: "You deposit",
    text: "USDC or USDT goes into one vault. There is no asset to pick: your money works on whichever desk, BTC or ETH, a trader needs.",
  },
  {
    title: "It waits in the vault",
    text: "Until a trader needs it, USDC sits in the vault and earns nothing. It is never lent and never put in a pool.",
  },
  {
    title: "A trader opens a position",
    text: "The asset's desk draws USDC from the vault's idle cash, buys the asset on the spot market and sells it to the trader at cost plus a fixed markup. One transaction.",
  },
  {
    title: "The position ends",
    text: "The trader pays the balance by the due date, or the asset is sold on the market. The vault gets back what it financed, plus the markup.",
  },
  {
    title: "The markup is split",
    text: "85% to depositors, 10% to the manager, 5% to the desk's loss reserve. Nothing else is charged to anyone.",
  },
];

export const dials = [
  {
    name: "Markup",
    value: "15.5% a year",
    note: "while the vault is under 85% financed, rising to 30% at the 92% cap. Plus 1.5% on 3x term positions.",
  },
  {
    name: "Payout",
    value: `${proposed.targetPayout} a year, target`,
    note: "Months above it fill a payout reserve, up to 6% of deposits. Months below it draw on the reserve.",
  },
  {
    name: "Deposits",
    value: "Admitted on demand",
    note: "New deposits only while more than 85% of the vault is financed, at most 5% growth a week. Idle USDC is returned if utilisation stays under 70% for 28 days.",
  },
  {
    name: "Withdrawals",
    value: "Instant",
    note: "against idle cash while no position's cover is under 110%. Otherwise a weekly queue, in time order.",
  },
];

// ---- Leverage: how a position works, from the trader's side ----

export const traderSteps = [
  "Pick an asset, a down payment, a leverage and a term.",
  "The desk buys the asset and sells it to you at cost plus a markup fixed for the whole term. One transaction, and the vault owns the asset before it sells it.",
  "The asset sits pledged in your position. Close, pay off or part-pay whenever you like; you pay only for the days used.",
  "At the due date the asset is sold. You get everything above the balance, less 10% of net profit. Below the balance, you lose the down payment and owe nothing more.",
];

export const modes = {
  columns: ["", "Term", "Margin"],
  rows: [
    ["Leverage", "BTC 3x, ETH 2x", "3x to 5x on BTC and ETH"],
    ["Length", "7 or 14 days", "Up to 30 days"],
    ["Early sale", "Never. There is no liquidation price.", "Part of the asset is sold if cover falls to 110%, enough to restore 115%."],
    ["Who carries a crash", "Your down payment, then the loss reserve, the backstop fund and staked SCR. Depositors only if all four run out.", "Mostly you"],
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
    line: "The asset is pledged until the balance is paid.",
  },
];

export const ruling = [
  { objection: "Fees for delay are riba", answer: "The price is fixed once. Nothing ever grows." },
  { objection: "A loan tied to a sale", answer: "There is no loan. The financing is the sale." },
  { objection: "Selling what is not owned", answer: "Real assets, owned by the vault before it sells them." },
  { objection: "Excessive risk", answer: "Low leverage, and a loss capped at the pledge." },
];

// ---- Safety: the layers, in the order a loss meets them ----

export const layers = [
  {
    name: "The trader's down payment",
    what: "It is inside the asset's value. The first third of a fall on a 3x position is the trader's.",
  },
  {
    name: "The desk's loss reserve",
    what: "Each desk, one per asset, keeps 5% of every markup it earns as a reserve, until the reserve holds 3% of what it has financed.",
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
    name: "The vault's depositors",
    what: "In proportion, through the share price. The manager's own deposit loses with them. One vault stands behind every desk, and no desk may finance more than 60% of it.",
  },
];

export const backtests = {
  columns: ["Position", "Average loss a year", "Worst year"],
  rows: [
    ["Term, BTC 3x, 14 days", "1.0%", "5.1% (2020)"],
    ["Term, ETH 2x, 14 days", "0.0%", "0.0%"],
  ],
  note:
    "Binance one-minute prices, January 2020 to August 2026, positions left unmanaged. Losses are a share of the amount financed, against a markup of 15.5% to 17% a year. On-chain markets are thinner than Binance, so treat these as a floor. The past does not bound the future.",
};

export const system = {
  columns: ["Whole system, 1,000 five-year paths", "Result"],
  rows: [
    [
      "Term mode, BTC 3x and ETH 2x, the launch economics",
      "Payout at or above 9% in every month. Depositors lose in 0.02% of years; worst year 0.5%.",
    ],
    ["A 60-minute outage on every forced sale", "Payout unchanged. Depositors lose in 1.5% of years; worst year 7.1%."],
  ],
};
