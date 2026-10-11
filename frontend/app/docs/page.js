import Link from "next/link";
import styles from "./docs.module.css";
import { pages } from "./nav";

export const metadata = { title: "Overview" };

// Who the reader is, and the page that answers their first question. Two to a row.
const paths = [
  { who: "Stablecoin depositor", go: "depositors", title: "What your USDC does", line: "It buys a coin a trader has committed to pay for. The markup is yours. Nothing is promised." },
  { who: "Leverage trader", go: "traders", title: "What a ticket costs", line: "One fixed markup, known before you open. No funding, no fees, no liquidation price in term mode." },
  { who: "SCR buyer or staker", go: "scr", title: "What the token does", line: "Backstop, liquidity reserve, one pool. The reserve sale, the fee splits, the allocation." },
  { who: "Investor", go: "thesis", title: "Why this, why now", line: "A locked-out market, one new primitive, and economics simulated over nine years of prices." },
  { who: "Engineer", go: "architecture", title: "How it is built", line: "The stack, the pieces, who calls whom, where every USDC goes. Then the addresses, invariants and tests." },
  { who: "Scholar", go: "shariah", title: "The contracts and the rulings", line: "Mudarabah, murabaha and rahn with sources, and each open ruling with the design's own odds." },
];

export default function DocsOverview() {
  return (
    <>
      <h1>Sacred Documentation</h1>
      <p className={styles.lead}>
        Sacred is an onchain money markets protocol that offers market-leading stablecoin yields and up to 5x leverage
        on majors in a shariah-fashioned way. It does so by taking capital from the risk-averse savers and giving it to
        risk-taking traders, thereby letting traders gain leveraged exposure to make gains, at a fixed cost called
        markup and a capped time, which is then paid back to savers for using their capital. This markup becomes the
        yield for the savers.
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
