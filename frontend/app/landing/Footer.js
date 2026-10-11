import Link from "next/link";
import { links } from "./content";
import styles from "./landing.module.css";

export default function Footer() {
  return (
    <footer className={styles.wrap}>
      <div className={styles.footer}>
        <p>
          Sacred is pre-launch. Term mode is deployed on Arbitrum One behind an allow-list and is not audited. No
          Shariah board has reviewed the design, so nothing here is certified halal. Every number is a proposal, a
          backtest or a simulation, not a promise. This page is not an offer to sell anything.
        </p>
        <div className={styles.footerLinks}>
          <Link href={links.app}>Launch app</Link>
          <Link href={links.docs}>Docs</Link>
          <a href={links.lightpaper}>Lightpaper</a>
          <a href={links.waitlist}>Waitlist</a>
        </div>
      </div>
    </footer>
  );
}
