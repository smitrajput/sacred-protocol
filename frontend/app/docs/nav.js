// The docs' table of contents, in reading order: the order an investor does diligence in. The
// layout draws the sidebar from it and each page's previous/next links come from the flattened
// list. Slugs are folders under app/docs.

export const sections = [
  {
    title: "The case",
    pages: [
      { slug: "", title: "Overview", blurb: "One screen: what Sacred is, where it stands, and where to read next." },
      { slug: "thesis", title: "Thesis", blurb: "The market that is locked out, the one new primitive, and what it grows into." },
      { slug: "mechanism", title: "Mechanism", blurb: "A position from opening to its end, with every number, and the rules that never bend." },
      { slug: "economics", title: "Economics", blurb: "What traders pay, what depositors earn, what the protocol keeps, and the simulation the dials were cut from." },
      { slug: "risk", title: "Risk", blurb: "The order of loss, nine years of backtests, the Monte Carlo, and what remains at risk." },
      { slug: "shariah", title: "Shariah", blurb: "The contracts and their sources, the 2006 ruling answered, and each open ruling with its odds." },
      // Status and roadmap is hidden while it is rewritten. Its page lives at app/docs/_status (the
      // underscore keeps Next from routing it); rename the folder back to status and restore this line:
      // { slug: "status", title: "Status and roadmap", blurb: "What is built and deployed, what is not, the gates for each phase, and the open decisions." },
    ],
  },
  {
    title: "Your part in it",
    pages: [
      { slug: "depositors", title: "Depositors", blurb: "One vault and its desks, the 9% target and its reserve, the share price, withdrawals, what can be lost." },
      { slug: "traders", title: "Traders", blurb: "The cost, the three ways a position ends, the three modes, and what to expect from a forced sale." },
      { slug: "scr", title: "SCR: holders, stakers, reserve buyers", blurb: "The token's three jobs, the reserve sale, the fee splits, the allocation, and the attacks the design closes." },
    ],
  },
  {
    title: "Under the hood",
    pages: [
      { slug: "architecture", title: "Technical architecture", blurb: "The stack, the pieces, who calls whom, where every USDC goes, a position's states, and the design choices." },
      { slug: "contracts", title: "Contracts and code", blurb: "Verified Arbitrum One addresses, the rules each contract keeps, every dial, and how to run it all." },
      { slug: "glossary", title: "Glossary", blurb: "The words, used the same way everywhere." },
    ],
  },
];

export const pages = sections.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.title, href: `/docs${p.slug ? `/${p.slug}` : ""}` })));
