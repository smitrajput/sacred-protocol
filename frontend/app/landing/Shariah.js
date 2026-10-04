import { ruling } from "./content";
import styles from "./landing.module.css";

export default function Shariah() {
  return (
    <section id="shariah" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>Built to answer the 2006 ruling, point by point.</h2>
        <p className={styles.lead}>
          The Muslim World League&rsquo;s Fiqh Council ruled against margin trading for four reasons. Sacred
          answers each one.
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
          <em>Not certified yet.</em> Fifteen points go to a Shariah board before launch, among them whether BTC and
          ETH can be sold on deferred payment and whether owning the coin within one transaction counts as
          possession. If the board says no to any of them, the design changes.
        </p>
      </div>
    </section>
  );
}
