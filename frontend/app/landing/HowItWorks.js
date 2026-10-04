import { contracts, steps } from "./content";
import styles from "./landing.module.css";

export default function HowItWorks() {
  return (
    <section id="how" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>One purchase, financed by a sale.</h2>
        <p className={styles.lead}>
          A vault of depositors&rsquo; USDC buys a real coin and sells it to the trader at cost plus a fixed markup.
          The trader pays part now and the rest by a due date. The coin stays pledged until then.
        </p>

        <ol className={styles.steps}>
          {steps.map((text) => (
            <li key={text} className={styles.step}>
              {text}
            </li>
          ))}
        </ol>
        <p className={`${styles.small} ${styles.caption}`}>Steps 1 to 3 happen in a single transaction.</p>

        <div className={styles.contracts}>
          <h3 className={styles.h3}>Three contracts Muslims have used for centuries.</h3>
          <div className={styles.contractRows}>
            {contracts.map((c) => (
              <div key={c.name} className={styles.contractRow}>
                <span className={styles.contractName}>{c.name}</span>
                <span className={styles.contractBetween}>{c.between}</span>
                <span className={styles.contractLine}>{c.line}</span>
              </div>
            ))}
          </div>
          <p className={`${styles.body} ${styles.afterRows}`}>
            The markup traders pay is the depositors&rsquo; yield, all of it. A bucket with 80% of its USDC financed at
            11% a year earns about 7.9% a year for depositors before any shortfalls. That is arithmetic on proposed
            values, not a forecast.
          </p>
        </div>
      </div>
    </section>
  );
}
