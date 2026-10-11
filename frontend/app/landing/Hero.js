import Link from "next/link";
import shared from "../shared/shared.module.css";
import { links } from "./content";
import styles from "./landing.module.css";

// The opening screen: one statement, centred, with nothing competing for attention.
// The worked ticket lives under How it works, beside the steps it illustrates.
export default function Hero() {
  return (
    <section className={`${styles.wrap} ${styles.hero}`}>
      <h1 className={styles.h1}>
        Onchain <em>Shariah-powered</em> <span>Money Markets</span>
      </h1>
      <p className={styles.heroLead}>Up to 11% in stablecoin yield and 5x leverage on majors, grounded in Shariah.</p>
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
