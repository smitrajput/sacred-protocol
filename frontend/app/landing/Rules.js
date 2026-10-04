import { rules } from "./content";
import styles from "./landing.module.css";

export default function Rules() {
  return (
    <section id="rules" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>Five rules the code keeps.</h2>
        <p className={styles.lead}>
          Each one is a Foundry test or invariant in the repository, not a sentence in a document.
        </p>

        <div className={styles.rules}>
          {rules.map((r) => (
            <div key={r.test} className={styles.rule}>
              <p className={styles.ruleText}>{r.rule}</p>
              <p className={styles.ruleProof}>
                {r.proof}
                <code>{r.test}</code>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
