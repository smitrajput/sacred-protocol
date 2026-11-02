import Link from "next/link";
import styles from "./docs.module.css";
import { sections } from "./nav";

export const metadata = { title: "Overview" };

// Who the reader is, and the page that answers their first question. Two to a row.
const paths = [
  { who: "Saver", go: "earn", title: "Put stablecoins to work", line: "Earnings come from fixed financing markup. The return is variable, and it depends on how much of the vault is in use." },
  { who: "Trader", go: "trade", title: "More buying power, costs upfront", line: "Buy BTC or ETH with up to 5× leverage and one fixed dollar cost, no funding payments and no share of your profit." },
  { who: "Holder", go: "borrow", title: "USDC against your crypto", line: "Pledge collateral, receive spendable USDC, repay a fixed amount and take your collateral back." },
  { who: "Prop trader", go: "trade/sift", title: "SIFT: capital follows evidence", line: "Real trades from day one. Qualifying traders can reach $10,000 of financing in 2 weeks and $100,000 in 12." },
  { who: "Investor", go: "thesis", title: "Thesis", line: "The market, the one new primitive, and the measured tradeoffs behind fixed-price financing." },
  { who: "Scholar", go: "shariah", title: "The contracts and what needs approval", line: "Each sale, pledge and partnership, the Arc and USDC premise, and the open questions." },
  { who: "Engineer", go: "architecture", title: "How it is built", line: "Separate vaults, a canonical account ledger, the existing deployment and the proposed engine." },
  { who: "Getting started", go: "funding", title: "Add funds", line: "Exchange and wallet routes onto Arc, with the exact tokens and networks." },
];

const products = [
  { name: "Earn", status: "Proposed. First release.", line: "Deposits finance Trade positions. 77% of base markup goes to depositors." },
  { name: "Trade", status: "Proposed. First release.", line: "A 14-day fixed sale of BTC or ETH, up to 5×. From 10% annualized on financing, 0% of your profit." },
  { name: "Borrow", status: "Proposed. After Trade.", line: "A 30-day fixed sale of USDC against collateral, funded by a separate 12-month pool." },
];

export default function DocsOverview() {
  return (
    <>
      <h1>Sacred Documentation</h1>
      <p className={styles.lead}>
        Sacred is onchain financing for holding and trading halal assets. It gives people three things to do with their
        crypto: earn on stablecoins, trade BTC and ETH with more buying power, and access USDC against what they already
        hold. All three run on sales with a price fixed upfront, rather than loans with a rate that moves.
      </p>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>What it is</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.line}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        Everything on these pages describes a proposed design unless it says otherwise. The numbers are research
        parameters as of 2 November 2026. Nothing here is deployed on Arc, audited or approved by a Shariah board.
      </p>

      <h2>Start where your question is</h2>
      <ul className={styles.cards}>
        {paths.map((p) => (
          <li key={p.go}>
            <Link href={`/docs/${p.go}`} className={styles.card}>
              <small>{p.who}</small>
              <b>{p.title}</b>
              <span>{p.line}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2>Everything here</h2>
      {sections.map((section) => (
        <div key={section.title}>
          <h3>{section.title}</h3>
          <ul className={styles.map}>
            {section.pages
              .filter((p) => p.slug)
              .map((p) => (
                <li key={p.slug}>
                  <Link href={`/docs/${p.slug}`}>{p.title}</Link>
                  <span>{p.blurb}</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </>
  );
}
