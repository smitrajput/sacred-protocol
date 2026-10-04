import Link from "next/link";
import { links } from "./content";
import styles from "./landing.module.css";

export default function Footer() {
  return (
    <footer className={styles.wrap}>
      <div className={styles.footer}>
        <p>
          Sacred is at design stage. No Shariah board has reviewed it, so nothing here is certified halal. Every
          number is a proposal or a backtest result, not a promise. This page is not an offer to sell anything.
        </p>
        <div className={styles.footerLinks}>
          <Link href={links.app}>Launch app</Link>
          <a href={links.lightpaper}>Lightpaper</a>
          <span>Aionera FZ-LLC, UAE</span>
        </div>
      </div>
    </footer>
  );
}
