// All copy for the landing page, in one place. Numbers come from the lightpaper and the
// README; test names come from contracts/test. Edit here, not in the components.

export const links = {
  app: "/app",
  lightpaper: "/sacred-lightpaper.pdf",
};

// The coin in the hero's worked ticket. Its leverage ceiling comes from lib/defaults.js.
export const exampleCoin = "ETH";

export const nav = [
  { label: "How it works", href: "#how" },
  { label: "Safety", href: "#safety" },
  { label: "Shariah", href: "#shariah" },
  { label: "Lightpaper", href: links.lightpaper },
];

export const steps = [
  "The vault buys the coin on the spot market with depositors' USDC.",
  "It sells the coin to the trader at cost plus a markup, fixed once for the whole term.",
  "The trader pays a down payment now. The coin stays pledged until the balance is paid.",
  "The trader closes or pays off whenever they like and pays only for the days used. After the due date, anyone can settle.",
];

export const contracts = [
  {
    name: "Mudarabah",
    between: "Depositors and the manager",
    line: "Depositors fund, the manager runs the desk, profit is shared, nothing is guaranteed.",
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

export const rules = [
  {
    rule: "The vault owns the coin before it sells it.",
    proof: "open lends the full cost and swaps before it records the sale or takes the down payment.",
    test: "test_open_recordsTheDesignExample",
  },
  {
    rule: "The balance never increases. No penalty, no roll-over.",
    proof: "No function adds to financed or markup, or subtracts from repaid.",
    test: "invariant_aBalanceNeverIncreases",
  },
  {
    rule: "The trader never owes more than the pledged coin.",
    proof: "settle never pulls from the trader. A short sale closes the debt.",
    test: "invariant_settlementNeverChargesTheTrader",
  },
  {
    rule: "Only the trader can sell before the due date.",
    proof: "settle reverts until the due date has passed, and there is no other sale path.",
    test: "test_noOneCanSellBeforeDueExceptTheTrader",
  },
  {
    rule: "Closing, paying off and withdrawing can never be paused.",
    proof: "Only open and requestDeposit check the pause flag. The guardian can pause but not unpause.",
    test: "test_deposit_pausedByGuardian_withdrawalsStillWork",
  },
];

export const lossOrder = [
  "The trader's down payment",
  "The bucket's loss reserve",
  "The backstop fund's USDC",
  "The depositors of that bucket, in proportion",
];

export const backtests = {
  columns: ["Ticket", "Average loss a year", "Worst year"],
  rows: [
    ["Term, BTC 3x, 14 days", "1.0%", "5.1% (2020)"],
    ["Term, ETH 2x, 14 days", "0.0%", "0.0%"],
  ],
  note:
    "Binance one-minute prices, January 2020 to August 2026, tickets left unmanaged. Losses are a share of the amount financed, against markup of about 11% a year. On-chain markets are thinner than Binance, so treat these as a floor. The past does not bound the future.",
};

export const ruling = [
  { objection: "Fees for delay are riba", answer: "The price is fixed once. Nothing ever grows." },
  { objection: "A loan tied to a sale", answer: "There is no loan. The financing is the sale." },
  { objection: "Selling what is not owned", answer: "Real coins, owned by the vault before it sells them." },
  { objection: "Excessive risk", answer: "Low leverage, and a loss capped at the pledge." },
];

export const plan = [
  { title: "Term mode first.", detail: "BTC and ETH, 7 and 14 day tickets, low leverage." },
  { title: "Whitelisted traders and depositors.", detail: "Deposits capped at 1 million USDC, raised in steps." },
  { title: "Points from day one.", detail: "No token yet." },
  { title: "Longer terms and evergreen tickets.", detail: "As rulings arrive and the reserve grows." },
  { title: "SCR.", detail: "After 6 to 12 months of real fees." },
];
