import Link from "next/link";
import styles from "./docs.module.css";
import { pages } from "./nav";

export const metadata = { title: "Overview" };

// Who the reader is, and the page that answers their first question.
const paths = [
  { who: "Investor", go: "thesis", title: "Why this, why now", line: "A locked-out market, one new primitive, and economics simulated over nine years of prices." },
  { who: "Depositor", go: "depositors", title: "What your USDC does", line: "It buys a coin a trader has committed to pay for. The markup is yours. Nothing is promised." },
  { who: "Trader", go: "traders", title: "What a ticket costs", line: "One fixed markup, known before you open. No funding, no fees, no liquidation price in term mode." },
  { who: "SCR buyer or staker", go: "scr", title: "What the token does", line: "Backstop, liquidity reserve, one pool. The reserve sale, the fee splits, the allocation." },
  { who: "Scholar", go: "shariah", title: "The contracts and the rulings", line: "Mudarabah, murabaha and rahn with sources, and each open ruling with the design's own odds." },
  { who: "Engineer", go: "contracts", title: "The code", line: "Verified addresses, the invariants and their tests, every dial, and how to run it on one machine." },
];

export default function DocsOverview() {
  return (
    <>
      <h1>Sacred documentation</h1>
      <p className={styles.lead}>
        A vault buys a real coin and sells it to a trader at cost plus a fixed markup. The trader pays part now and
        the rest later; the coin stays pledged until the balance is paid. No loan, so no interest. The markup is the
        depositors&rsquo; yield. That is the whole product, and it is built.
      </p>

      <div className={styles.status}>
        <p>
          <b>As of October 2026.</b> Term mode is built end to end and deployed on Arbitrum One behind an allow-list.
          Not audited. No Shariah board has ruled. SCR is on chain under a placeholder name and is not live. A
          mechanism-design simulation proposes new economics for version two; they are not in the code. Details on{" "}
          <Link href="/docs/status">status and roadmap</Link>.
        </p>
      </div>

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

      <h2>In reading order</h2>
      <ul className={styles.map}>
        {pages
          .filter((p) => p.slug)
          .map((p) => (
            <li key={p.href}>
              <Link href={p.href}>{p.title}</Link>
              <span>{p.blurb}</span>
            </li>
          ))}
      </ul>

      <h2>Elsewhere</h2>
      <ul>
        <li>
          <a href="/sacred-lightpaper.pdf">The lightpaper</a>: seven pages, for print.
        </li>
        <li>
          <Link href="/app">The app</Link>, against the Arbitrum One deployment.
        </li>
        <li>
          <Link href="/#waitlist">The waitlist</Link>, for a seat when the allow-list opens.
        </li>
      </ul>
    </>
  );
}
