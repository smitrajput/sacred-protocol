import Link from "next/link";
import shared from "../shared/shared.module.css";
import { hero, links } from "./content";
import styles from "./landing.module.css";

// The opening screen: three verbs across one line, centred, with nothing competing for
// attention. Read the top row alone and it is the headline; read down and each column is the
// pitch for one product. The closing line and two actions sit beneath. The worked position
// lives under How it works, beside the steps it illustrates.
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
        <em>{word}</em>
        {after}
      </p>
      <div className={styles.ctas}>
        <a href={links.waitlist} className={`${shared.btn} ${shared.btnPrimary}`}>
          Join waitlist
        </a>
        <Link href={links.docs} className={`${shared.btn} ${shared.btnGhost}`}>
          Read the docs
        </Link>
      </div>
    </section>
  );
}
