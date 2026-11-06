// All copy for the landing page and the product pages, in one place. Figures are the proposed
// launch parameters in lib/params.js; the docs carry the same numbers. Edit here, not in the
// components.

import { BORROW, EARN, LADDER, LAUNCH_TIER, SIFT } from "../../lib/params";
import { borrowQuote, pct, siftCeiling, usd } from "../../lib/quote";

// Production access actions. The separate Launch app button opens the Arc Testnet demo.
export const launched = false;

export const links = {
  home: "/",
  docs: "/docs",
  signup: "#signup",
  explore: "#earn",
  app: "/app",
};

export const action = launched
  ? { primary: { label: "Get started", href: links.app }, secondary: { label: "Sign in", href: links.app } }
  : { primary: { label: "Get early access", href: `/${links.signup}` }, secondary: null };

export const contact = {
  support: "support@sacred.markets",
  enquiries: "smit@sacred.markets",
};

const support = "/docs/support";
const protection = "/docs/risk#how-your-funds-are-protected";
const shariahDocs = "/docs/shariah";

export const nav = [
  { label: "Earn", href: "/#earn" },
  { label: "Trade", href: "/#trade" },
  { label: "Borrow", href: "/#borrow" },
  { label: "FAQ", href: "/#faq" },
];

export const resources = [
  { label: "Shariah", href: shariahDocs },
  { label: "Security", href: protection },
  { label: "Docs", href: links.docs },
  { label: "Support", href: support },
];

// The hero: three verbs across one line, each with the sentence that explains it beneath, so
// the headline and the lead are the same three columns read at two sizes.
export const hero = {
  columns: [
    { verb: "Earn", rest: "Up to 7% APY on stablecoins." },
    { verb: "Trade", rest: "BTC & ETH with up to 5× leverage." },
    { verb: "Borrow", rest: "USDC against your crypto." },
  ],
  closing: ["Grounded in ", "Shariah", "."],
  closingHref: shariahDocs,
};

const topTier = LADDER.at(-1);

export const higherTiers = "Higher tiers are gradually opened as their protection is earned and Shariah rulings approved.";
const refBorrow = borrowQuote({ collateral: 10_000 });
const strong = EARN.cases[0];
const weak = EARN.cases[2];

// ---- The three products: equal sections, one shape ----

export const earn = {
  id: "earn",
  eyebrow: "Earn",
  heading: "Put your stablecoins to work.",
  lead: "Deposit USDC. It finances real BTC and ETH purchases at a fixed markup, and you receive a share of that markup.",
  facts: [
    ["The return", `Modeled ${pct(weak.apy, 2)} to ${pct(strong.apy, 2)} APY at $10m of deposits, depending on how much of the vault is in use. Variable, and not guaranteed.`],
    ["Where earnings come from", "Fixed markup that traders pay for financing. Idle cash earns nothing, and no one pays interest."],
    ["Fees", "Sacred keeps 23% of base markup. Depositors receive 77%. No other Earn fee is proposed."],
    ["Withdrawal timing", "From idle cash first, then a daily queue filled as positions settle. About 7 days for half the vault and 14 for all of it."],
    ["Protection", "Your funds are protected by 4 layers of backstops before a loss touches your principal.", { text: "4 layers of backstops", href: protection }],
  ],
  cta: { label: "Explore Earn", href: "/earn" },
};

export const trade = {
  id: "trade",
  eyebrow: "Trade",
  heading: "More buying power. Costs shown upfront.",
  lead: "Buy real BTC or ETH with your capital plus Sacred financing. One fixed dollar cost, no funding payments, and your profit stays yours.",
  facts: [
    ["Your contribution", `You put in part of the position. Financing covers the rest, up to your ceiling. New accounts start with up to $${usd(SIFT.starterCeiling, 0)} of financing.`],
    ["Exposure", `Up to ${topTier.leverage}× leverage, on real spot assets you own, pledged until the debt is paid.`],
    ["Costs", `${pct(LAUNCH_TIER.apr, 0)} annualized on financing at ${LAUNCH_TIER.leverage}×, up to ${pct(topTier.apr, 0)} at ${topTier.leverage}×, fixed in dollars for 14 days, plus execution. Sacred takes no share of your profit.`],
    ["Liquidation", "If your position's value falls to the coverage level in your quote, part of it is sold to restore cover. You keep the rest, and you can never owe more than you pledged."],
  ],
  cta: { label: "Explore Trade", href: "/trade" },
};

export const borrow = {
  id: "borrow",
  eyebrow: "Borrow",
  heading: "Access USDC against your crypto.",
  lead: "Keep your BTC or ETH exposure and get spendable USDC. Repay a fixed amount, and your collateral comes back.",
  facts: [
    ["Supported assets", "WETH and cirBTC on Arc are the candidates. Each opens only once its backing and market depth are verified."],
    ["Borrowing capacity", `Up to ${pct(BORROW.entryLtv, 0)} of your collateral's value, from $${usd(BORROW.minFinancing, 0)} to $${usd(BORROW.maxPerBorrower, 0)} per person in the pilot.`],
    ["Costs", "A fixed price for 30 days, set before launch. Repay early and you pay only for the days used, if the rebate is approved."],
    ["Liquidation", `At ${pct(BORROW.liquidationLtv)} debt LTV, only the collateral needed to return to ${pct(BORROW.restoreLtv, 0)} is sold. Any surplus is yours.`],
  ],
  flow: [
    { label: "Pledge collateral", value: `$${usd(refBorrow.collateral, 0)}`, note: "Stays yours" },
    { label: "Receive USDC", value: usd(refBorrow.usdc, 0), note: "Spend it freely" },
    { label: "Repay by day 30", value: usd(refBorrow.debt), note: "Fixed at the sale" },
    { label: "Collateral released", value: `$${usd(refBorrow.collateral, 0)}`, note: "Back in your wallet" },
  ],
  flowNote: "Uses the 8% reference price, which is not a launch quote. Borrow follows Trade and is not yet enabled.",
  cta: { label: "Explore Borrow", href: "/borrow" },
};

// ---- SIFT: the allocation engine behind Trade and Earn ----

export const sift = {
  eyebrow: "SIFT · Skill-Informed Financing Tiers",
  heading: "Capital follows evidence.",
  lead: "Prop firms scale traders with discipline, but on paid challenges and simulated accounts. SIFT keeps the discipline and drops the simulation: you trade real capital from day one, and your financing grows as your results earn it.",
  milestones: [
    { when: "Day one", ceiling: siftCeiling(0) },
    ...SIFT.milestones.map(({ weeks, day }) => ({ when: `Week ${weeks}`, ceiling: siftCeiling(day) })),
  ],
  milestoneNote: "Fast at first, then slower as your limit rises. The maximum path for a qualifying trader at a funded public release, with your own capital beneath the financing and vault capacity to match.",
  rules: "A day counts only with real use of your limit, positive net results and drawdown under 10%. Every 14 qualifying days you also show repaid financing.",
  cuts: "A 20% drawdown halves your limit, and 30% or a principal shortfall freezes new financing.",
  cta: { label: "How SIFT works", href: "/docs/trade/sift" },
};

// ---- Funding ----

export const funding = {
  heading: "Start with the crypto you already have.",
  steps: [
    { title: "Create an account or connect a wallet", text: "Sign in with your email, Apple ID or Google account for a wallet you control, or connect MetaMask or Rabby." },
    { title: "Add funds", text: "Follow the guided route. Supported incoming assets arrive as USDC on Arc." },
    { title: "Earn, trade or borrow", text: "Your balance shows as Available until you choose where it goes." },
  ],
  routes: [
    { group: "Exchanges", items: ["Binance", "Bybit"], note: "Withdraw USDC directly to Arc where open, or through a supported network." },
    { group: "Wallets", items: ["MetaMask", "Rabby"], note: "Connect and send USDC on Arc, or bridge it from a supported chain." },
  ],
  link: { label: "Exact tokens and networks", href: "/docs/funding" },
};

// ---- FAQ ----

export const faq = [
  {
    group: "Getting started",
    items: [
      { q: "Can I use Sacred today?", a: "The Arc Testnet demo is live: try USDC Earn and 2× cirBTC trading with test assets using Launch app. The broader products described here are planned for production. Get early access for launch updates.", link: { text: "Get early access", href: `/${links.signup}` } },
      { q: "Where is Sacred available?", a: "Web first, with iOS and Android to follow. Availability will depend on your country and the product. Some products may not be offered everywhere." },
      { q: "Is there a minimum?", a: "No product minimum is planned for Earn or Trade. Very small positions pay a larger share of execution costs. Borrow is planned to start at $1,000." },
    ],
  },
  {
    group: "Custody and funding",
    items: [
      { q: "Who controls my funds?", a: "You do. Your account uses a wallet you control, either embedded with export and recovery, or your own. Money you put into a product follows that product's rules until it is available again." },
      { q: "How do I add funds?", a: "From an exchange or a wallet. Supported incoming assets arrive as USDC on Arc, and appear as Available in your account.", link: { text: "exchange or a wallet", href: "/docs/funding" } },
      { q: "Why Arc?", a: "Sacred's first release is planned for Arc as USDC being a gas token there simplifies protocol and user fee calculation and estimation, plus provides a stronger ground for USDC to be approved as a commodity by Shariah.", link: { text: "approved as a commodity by Shariah", href: `${shariahDocs}#arc-and-usdc` } },
    ],
  },
  {
    group: "Earn",
    items: [
      { q: "What will I earn?", a: `It depends on demand. Modeled at $10m of deposits the range is ${pct(weak.apy, 2)} to ${pct(strong.apy, 2)} APY. A small first pilot would earn less. Returns are variable and not guaranteed.` },
      { q: "Where does the return come from?", a: "Traders pay a fixed markup to finance purchases of BTC and ETH. Depositors receive 77% of base markup. Idle cash earns nothing." },
      { q: "What fees does Earn charge?", a: "Sacred's 23% share of base markup. No other Earn fee is proposed." },
      { q: "How do withdrawals work?", a: "They rank ahead of new financing. Money comes from idle cash first, then a daily queue filled as 14-day positions settle. Half the vault could leave in about 7 days and all of it in about 14, if positions settle as expected." },
      { q: "Can I lose money?", a: "Your funds are protected by 4 layers of backstops before a loss touches your principal: the trader's capital, primary protection, tail protection and a pilot backstop. A loss larger than all four reaches depositors. Contract, oracle, USDC and chain failures sit outside these layers.", link: { text: "4 layers of backstops", href: protection } },
    ],
  },
  {
    group: "Trade",
    items: [
      { q: "What does a trade cost?", a: "A markup fixed in dollars when you open, plus execution costs. At 2× that is $19.18 of markup and about $11 of execution on a $10,000 position over 14 days. No funding payments, and no share of your profit." },
      { q: "Do I own the asset?", a: "Yes. Sacred buys the asset and sells it to you. It stays pledged until you pay the debt, then you can take it to your wallet." },
      { q: "When is my position sold?", a: "Each leverage level has its own coverage level, from 160% at 2×, about a 19.7% fall from entry, to 115% at 5×, about 7.2%. A partial sale restores cover, and you can repay to avoid it. You can lose your full contribution, but you can never owe more than you pledged." },
      { q: "Why is my financing limited?", a: "New accounts start with up to $500. Under SIFT, qualifying traders can reach $10,000 in 2 weeks, $50,000 in 6 and $100,000 in 12, always with their own capital beneath the financing.", link: { text: "SIFT", href: "/docs/trade/sift" } },
      { q: "What about higher leverage?", a: higherTiers },
    ],
  },
  {
    group: "Borrow",
    items: [
      { q: "How does Borrow work?", a: "You pledge collateral and accept a fixed-price sale of USDC. You spend the USDC, repay within 30 days and take your collateral back. Borrow follows Trade and is not yet enabled." },
      { q: "What does it cost?", a: "The price is not set. Examples use an 8% annualized reference: 29.59 USDC on 4,500 USDC for 30 days. Sacred does not claim to be the cheapest." },
      { q: "When is collateral liquidated?", a: "At 62.5% debt LTV, about a 27.5% fall from the example's start. Only what is needed to return to 50% is sold, and any surplus is yours. You can add collateral or repay to avoid it." },
    ],
  },
  {
    group: "Trust",
    items: [
      { q: "Is Sacred halal?", a: "Sacred is designed around Islamic sale and profit-sharing contracts, and no Shariah board has reviewed it yet. Until one does, Sacred makes no certified claim.", link: { text: "Islamic sale and profit-sharing contracts", href: shariahDocs } },
      { q: "Do I have to be Muslim?", a: "No. Sacred is open to anyone in a supported country." },
      { q: "Has Sacred been audited?", a: "Not yet. The Arc Testnet prototype is deployed, but has not had an independent audit. Production contracts will be independently reviewed before launch.", link: { text: "independently reviewed", href: protection } },
    ],
  },
];

// ---- Signup ----

export const signup = {
  heading: "Get early access.",
  lead: "Tell us what you would like to do, and we will let you know when it opens.",
  availability: "Web first. iOS and Android to follow.",
  question: "What would you like to do?",
  interests: [
    { value: "earn", label: "Earn" },
    { value: "trade", label: "Trade" },
    { value: "borrow", label: "Borrow" },
  ],
  others: [
    { label: "Investor enquiries", href: `mailto:${contact.enquiries}?subject=Investor%20enquiry` },
    { label: "Building with Sacred", href: `mailto:${contact.enquiries}?subject=Building%20with%20Sacred` },
  ],
  sources: ["Binance", "Bybit", "OKX", "Coinbase", "Other exchange", "MetaMask", "Rabby", "Other wallet", "None yet"],
  devices: ["Desktop", "Phone browser", "iPhone app", "Android app"],
};

export const footer = {
  note: "Sacred is pre-launch. No Shariah board has reviewed the design, so nothing here is certified halal. Every number is a proposal, a model or a backtest, not a promise. This page is not an offer to sell anything, and products may not be available in your country.",
  links: [
    { label: "Earn", href: "/earn" },
    { label: "Trade", href: "/trade" },
    { label: "Borrow", href: "/borrow" },
    { label: "Docs", href: links.docs },
    { label: "Support", href: support },
  ],
};
