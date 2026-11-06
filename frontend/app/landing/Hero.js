import Link from "next/link";
import shared from "../shared/shared.module.css";
import { action, hero, links } from "./content";
import styles from "./landing.module.css";

// The opening: three verbs across one line, centred. Read the top row alone and it is the
// headline; read down and each column is the pitch for one product. The closing line, which
// leads to the Shariah reasoning, and actions sit beneath.
export default function Hero() {
  const [before, word, after] = hero.closing;
  return (
    <section className={`${styles.wrap} ${styles.hero}`}>
      <h1 className={styles.ledger}>
        {hero.columns.map(({ verb, rest }, i) => (
          <span key={verb} className={styles.ledgerCol} style={{ "--i": i }}>
            <span className={styles.ledgerVerb}>{verb}.</span>
            <span className={styles.ledgerRest}>{rest}</span>
          </span>
        ))}
      </h1>
      <p className={styles.heroClosing}>
        {before}
        <Link href={hero.closingHref}>{word}</Link>
        {after}
      </p>
      <div className={styles.ctas}>
        <a href={links.app} target="_blank" rel="noopener noreferrer" aria-label="Launch app (opens in a new tab)" className={`${shared.btn} ${shared.btnPrimary}`}>
          Launch app
        </a>
        <Link href={action.primary.href} className={`${shared.btn} ${shared.btnGhost}`} data-track="interest">
          {action.primary.label}
        </Link>
        <a href={links.explore} className={`${shared.btn} ${shared.btnGhost}`}>
          Explore Sacred
        </a>
      </div>
    </section>
  );
}
