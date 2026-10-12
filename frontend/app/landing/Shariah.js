import { contracts, ruling } from "./content";
import styles from "./landing.module.css";

// Why the design is halal: the three classical contracts it is built from, and the 2006
// ruling against margin trading answered point by point.
export default function Shariah() {
  return (
    <section id="shariah" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>Three contracts Muslims have used for centuries.</h2>
        <p className={styles.lead}>
          A sale, a pledge and a partnership. Every position is one of each, in Solidity. The sale replaces the loan, so
          the question of interest never comes up.
        </p>

        <div className={styles.contractGrid}>
          {contracts.map((c) => (
            <div key={c.name} className={styles.contractRow}>
              <span className={styles.contractName}>{c.name}</span>
              <span className={styles.contractBetween}>{c.between}</span>
              <span className={styles.contractLine}>{c.line}</span>
            </div>
          ))}
        </div>

        <h3 className={`${styles.h3} ${styles.afterRows}`}>The 2006 ruling, answered point by point.</h3>
        <p className={`${styles.body} ${styles.afterList}`}>
          The Muslim World League&rsquo;s Fiqh Council ruled against margin trading for four reasons. Sacred answers
          each one.
        </p>

        <div className={styles.pairs}>
          {ruling.map((r) => (
            <div key={r.objection}>
              <span className={styles.objection}>{r.objection}</span>
              <p className={styles.answer}>{r.answer}</p>
            </div>
          ))}
        </div>

        <p className={styles.caveat}>
          <em>Not certified yet.</em> Ten points go to a Shariah board before launch, among them whether BTC and ETH
          can be sold on deferred payment, whether owning the asset within one transaction counts as possession, and
          the leverage ceiling. If the board says no to any of them, the design changes.
        </p>
      </div>
    </section>
  );
}
