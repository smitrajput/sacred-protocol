// The acquisition pages, one per product. Each is written for the visitor that campaign sends:
// savers to Earn, trading communities to Trade, holders who want cash to Borrow. All text sits here
// so a translation is one more object in this shape, with its funding and support copy localized.

export const pages = {
  earn: {
    id: "earn",
    meta: {
      title: "Earn on your stablecoins",
      description: "Put USDC to work through real asset financing. Modeled 3.55% to 7.14% APY at $10m of deposits, variable and not guaranteed. Grounded in Shariah.",
    },
    eyebrow: "Sacred Earn",
    heading: "Put your stablecoins to work.",
    lead: "Your USDC finances real BTC and ETH purchases. Traders pay a fixed markup, and you receive 77% of it. You can see where every dollar of return comes from.",
    notice: "Proposed design. Not live. Your funds are protected by 4 layers of backstops before a loss touches your principal.",
    cta: "Get early access to Earn",
    steps: {
      heading: "How your USDC earns",
      items: [
        { title: "You deposit USDC", text: "It joins one vault on Arc. You do not pick an asset or a trader." },
        { title: "It finances a purchase", text: "The vault buys BTC or ETH, and sells it to a trader at a fixed price over 14 days." },
        { title: "You receive markup", text: "The trader repays. 77% of base markup goes to depositors, whichever way the price moved." },
      ],
    },
    details: {
      heading: "The terms, plainly",
      rows: [
        ["Modeled return", "3.55% to 7.14% APY at $10m of deposits, set by how much of the vault is in use"],
        ["A small pilot", "About 3.85% a year if fully used, before losses"],
        ["Protection", "Your funds are protected by 4 layers of backstops before a loss touches your principal"],
        ["Fees", "Sacred keeps 23% of base markup. No other Earn fee is proposed"],
        ["Withdrawals", "Idle cash first, then a daily queue. About 7 days for half the vault and 14 for all of it, if positions settle"],
        ["Idle cash", "Stays in the vault, earns nothing, and is never lent"],
        ["Weak demand", "New deposits may be offered 70% of base markup. Existing terms never change"],
      ],
    },
    risks: {
      heading: "What can go wrong",
      items: [
        "Returns depend on traders. With little demand they fall, and no floor exists.",
        "Your funds are protected by 4 layers of backstops before a loss touches your principal: the trader's capital, primary protection, tail protection and a pilot backstop.",
        "A loss larger than all four reaches depositors, and no cushion covers every crash.",
        "Withdrawals can take days and depend on positions settling.",
        "Contract, USDC, oracle or Arc failures can cause loss.",
      ],
    },
    docs: { label: "How Earn works", href: "/docs/earn" },
    faq: ["Earn", "Custody and funding"],
  },

  trade: {
    id: "trade",
    meta: {
      title: "Trade BTC and ETH with up to 5× leverage",
      description: "More buying power with one fixed cost. Buy real BTC and ETH with up to 5× leverage, no funding payments, no share of your profit, and financing that grows with your results.",
    },
    eyebrow: "Sacred Trade",
    heading: "More buying power. Costs shown upfront.",
    lead: "Buy real BTC or ETH with up to 5× leverage and one dollar cost, fixed before you trade. No funding payments, no paid challenge and no share of your profit.",
    notice: "Proposed design. Not live. You can lose your contribution.",
    cta: "Get early access to Trade",
    steps: {
      heading: "How a position works",
      items: [
        { title: "Get a quote", text: "See your contribution, exposure, dollar cost and when a partial sale would begin." },
        { title: "Buy the asset", text: "The vault buys spot BTC or ETH and sells it to you at a fixed price. It stays pledged until you pay." },
        { title: "Repay or sell", text: "Within 14 days, repay and take the asset, or sell and keep what is left. Gains are all yours." },
      ],
    },
    details: {
      heading: "The terms, plainly",
      rows: [
        ["Leverage", "Up to 5×. Higher tiers are gradually opened as their protection is earned and Shariah rulings approved"],
        ["Starting financing", "Up to $500 for a new account, so a first full position is $1,000 at 2× or $625 at 5×"],
        ["Financing growth", "Qualifying traders can reach $10,000 in 2 weeks, $50,000 in 6 and $100,000 in 12 at a funded public release, with matching capital and vault capacity"],
        ["Cost", "10% annualized on financing at 2×, up to 20% at 5×, fixed in dollars for 14 days, plus execution"],
        ["Example", "At 2×, $5,000 of your capital buys $10,000 of asset: $19.18 of markup plus about $11 of execution"],
        ["Your profit", "Yours. Sacred takes no share at any tier"],
        ["Partial sale", "From 160% coverage at 2×, about 19.7% below entry, to 115% at 5×, about 7.2%. It restores cover, and you keep the rest"],
        ["Most you can lose", "Your contribution. You can never owe more than you pledged"],
        ["Compared with Hyperliquid", "Shown as information on each quote. At 2×, historically cheaper in most conditions, but more expensive in bear conditions and across 2026"],
      ],
    },
    risks: {
      heading: "What can go wrong",
      items: [
        "You can lose your full contribution, but you can never owe more than you pledged.",
        "Higher leverage costs more and leaves less room before a partial sale.",
        "A partial sale can happen during a fall that later reverses.",
        "A fast move or an outage can sell at a poor price.",
        "cirBTC and WETH on Arc add custody and bridge risk beyond the spot price.",
        "Financing is limited, and growth is never guaranteed.",
      ],
    },
    docs: { label: "How Trade works", href: "/docs/trade" },
    faq: ["Trade", "Custody and funding"],
    sift: true,
  },

  borrow: {
    id: "borrow",
    meta: {
      title: "Access USDC against your crypto",
      description: "Get spendable USDC without selling your crypto. Pledge collateral, repay a fixed amount and take it back. Proposed, and not yet enabled.",
    },
    eyebrow: "Sacred Borrow",
    heading: "Access USDC against your crypto.",
    lead: "Keep your BTC or ETH exposure and get spendable USDC. You agree a fixed amount to repay, and your collateral stays yours.",
    notice: "Proposed design. Follows Trade, and not yet enabled. Price not set.",
    cta: "Get early access to Borrow",
    steps: {
      heading: "From collateral to cash, and back",
      items: [
        { title: "Pledge collateral", text: "Deposit approved WETH or cirBTC. It stays yours and is never lent or reused." },
        { title: "Receive USDC", text: "Accept a fixed-price sale of up to 45% of your collateral's value, and spend it as you like." },
        { title: "Repay and release", text: "Repay within 30 days. Your collateral comes back when the debt reaches zero." },
      ],
    },
    details: {
      heading: "The terms, plainly",
      rows: [
        ["Supported assets", "WETH and cirBTC on Arc are candidates. Each opens only once its backing and depth are verified"],
        ["Borrowing capacity", "Up to 45% of collateral value, $1,000 to $5,000 per person in the pilot"],
        ["Term", "30 days"],
        ["Cost", "Fixed at acceptance and not yet set. Examples use an 8% annualized reference"],
        ["Example", "4,500 USDC against $10,000 of collateral, 4,529.59 USDC to repay at day 30"],
        ["Repay early", "4,506.90 USDC on day 7 under the proposed rebate, which needs approval"],
        ["Late charges", "None. No compounding, no automatic renewal, and a 24-hour cure for healthy accounts"],
        ["Liquidation", "At 62.5% debt LTV, or collateral at $7,247.34 in the example. Only what restores 50% is sold, and any surplus is yours"],
      ],
    },
    risks: {
      heading: "What can go wrong",
      items: [
        "Collateral can be partly sold during a fall that later reverses.",
        "Dated Aave and Morpho rates are currently lower than the 8% reference. Sacred offers a fixed price, not the lowest one.",
        "Borrow rests on a Shariah premise about USDC on Arc that is not yet confirmed.",
        "Wrapped and bridged collateral carries custody risk beyond the spot price.",
      ],
    },
    docs: { label: "How Borrow works", href: "/docs/borrow" },
    faq: ["Borrow", "Custody and funding"],
  },
};
