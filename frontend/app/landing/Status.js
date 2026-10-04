import Link from "next/link";
import shared from "../shared/shared.module.css";
import { links, plan } from "./content";
import styles from "./landing.module.css";

export default function Status() {
  return (
    <section id="status" className={styles.section}>
      <div className={`${styles.wrap} ${styles.status}`}>
        <div>
          <h2 className={styles.h2}>Where it stands.</h2>
          <p className={styles.lead}>
            Term mode is built end to end: the vault, the desk, the price reader and the backstop fund in Solidity,
            a keeper and read API, and the app behind this button. Nothing is deployed, audited or certified.
          </p>
          <div className={styles.ctas}>
            <Link href={links.app} className={`${shared.btn} ${shared.btnPrimary}`}>
              Launch app
            </Link>
            <a href={links.lightpaper} className={`${shared.btn} ${shared.btnGhost}`}>
              Read the lightpaper
            </a>
          </div>
        </div>

        <ol className={styles.plan} aria-label="Launch plan">
          {plan.map((step) => (
            <li key={step.title}>
              <span>
                <b>{step.title}</b> {step.detail}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
