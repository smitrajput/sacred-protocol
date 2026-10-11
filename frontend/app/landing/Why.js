import { why } from "./content";
import styles from "./landing.module.css";

// The problem on each side of the market and Sacred's answer, three columns, one figure each.
export default function Why() {
  return (
    <section id="why" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>{why.heading}</h2>
        <p className={styles.lead}>{why.lead}</p>

        <div className={styles.why}>
          {why.columns.map((c) => (
            <div key={c.who} className={styles.whyCol}>
              <span className={styles.whyWho}>{c.who}</span>
              <p className={styles.figure}>
                {c.figure}
                <span>{c.unit}</span>
              </p>
              <p className={styles.problem}>{c.problem}</p>
              <p className={styles.answerText}>{c.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
