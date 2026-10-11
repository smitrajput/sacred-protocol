import Link from "next/link";
import shared from "../shared/shared.module.css";
import styles from "./docs.module.css";
import DocsNav from "./DocsNav";
import DocsPager from "./DocsPager";

export const metadata = { title: { default: "Docs", template: "%s | Sacred docs" } };

// The docs under /docs: a fixed table of contents on the left, one MDX page on the right.
// The page list lives in nav.js; the prose styles in docs.module.css.
export default function DocsLayout({ children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link href="/" className={styles.brand}>
          Sacred
        </Link>
        <span className={styles.barDocs}>
          <Link href="/docs">Docs</Link>
        </span>
        <div className={styles.barRight}>
          <a href="/sacred-lightpaper.pdf" className={styles.barLink}>
            Lightpaper
          </a>
          <Link href="/app" className={`${shared.btn} ${shared.btnPrimary}`}>
            Launch app
          </Link>
        </div>
      </header>

      <div className={styles.columns}>
        <DocsNav />
        <main className={styles.main}>
          <article className={styles.prose}>{children}</article>
          <DocsPager />
          <p className={styles.foot}>
            Sacred is pre-launch. No Shariah board has reviewed it, nothing is audited, and every number is a proposal
            or a backtest result, not a promise. These pages are not an offer to sell anything.
          </p>
        </main>
      </div>
    </div>
  );
}
