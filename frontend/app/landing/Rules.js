import { rules } from "./content";
import styles from "./landing.module.css";

// The rules as numbered clauses: the statement, then how the code keeps it and the test that
// holds it. The numbers carry information here; they are how the docs and the tests refer to them.
export default function Rules() {
  return (
    <section id="rules" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>Five rules the code keeps.</h2>
        <p className={styles.lead}>
          Each one is a Foundry test or invariant in the repository, not a sentence in a document.
        </p>

        <div className={styles.clauses}>
          {rules.map((r, i) => (
            <div key={r.test} className={styles.clause}>
              <span className={styles.clauseNo}>{String(i + 1).padStart(2, "0")}</span>
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
