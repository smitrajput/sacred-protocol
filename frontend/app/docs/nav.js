// The docs' table of contents. Three products, each with its own section; what they share comes
// after them. The layout draws the sidebar from it and each page's previous/next links come from
// the flattened list. Slugs are folders under app/docs.

export const sections = [
  {
    title: "Start here",
    pages: [
      { slug: "", title: "Overview", blurb: "One screen: the three products, where they stand, and where to read next." },
      { slug: "thesis", title: "Thesis", blurb: "The market, the one new primitive, and what fixed-price financing does and does not offer." },
      { slug: "funding", title: "Add funds", blurb: "Every supported route onto Arc: exchanges, wallets, tokens and networks." },
      { slug: "support", title: "Support", blurb: "How to reach us, and what we will never ask you for." },
    ],
  },
  {
    title: "Earn",
    pages: [
      { slug: "earn", title: "How Earn works", blurb: "Where the return comes from, the modeled range, fees, withdrawals and what protects a deposit." },
      { slug: "earn/economics", title: "Returns and allocation", blurb: "The markup split, demand cases, conservation terms, earned protection and scale." },
    ],
  },
  {
    title: "Trade",
    pages: [
      { slug: "trade", title: "How Trade works", blurb: "A position up to 5×, its fixed cost, partial sales, financing limits and the market benchmark." },
      { slug: "trade/sift", title: "SIFT", blurb: "How financing follows evidence: the growth curve, qualifying days, repayment checkpoints and the limits nothing bypasses." },
      { slug: "trade/mechanism", title: "Trade mechanics", blurb: "Purchase, ownership, sale, pledge, partial sale and settlement, and the leverage ladder." },
    ],
  },
  {
    title: "Borrow",
    pages: [
      { slug: "borrow", title: "How Borrow works", blurb: "USDC against your crypto: capacity, costs, repayment and liquidation." },
      { slug: "borrow/mechanism", title: "Borrow mechanics", blurb: "Inventory, fixed sale, delivery, pledge, rebate and settlement." },
      { slug: "borrow/economics", title: "Pricing and reserves", blurb: "How quotes are set, what investors keep, reserve formation and company costs." },
      { slug: "borrow/investors", title: "Funding Borrow", blurb: "The 12-month mandate, monthly profit, runoff, reserve ownership and loss carry." },
    ],
  },
  {
    title: "Safety and Shariah",
    pages: [
      { slug: "risk", title: "Risk", blurb: "How your funds are protected, what was tested and what it showed." },
      { slug: "shariah", title: "Shariah", blurb: "The contracts, the Arc and USDC premise, and exactly what still needs approval." },
    ],
  },
  {
    title: "Under the hood",
    pages: [
      { slug: "architecture", title: "Architecture", blurb: "Separate vaults, shared infrastructure, the SIFT ledger and who may do what." },
      { slug: "contracts", title: "Contracts and code", blurb: "What exists today, what is proposed, verified addresses and how to run it." },
      { slug: "glossary", title: "Glossary", blurb: "The words, used the same way everywhere." },
    ],
  },
];

export const pages = sections.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.title, href: `/docs${p.slug ? `/${p.slug}` : ""}` })));
