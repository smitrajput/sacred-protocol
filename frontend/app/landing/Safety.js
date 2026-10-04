import { backtests, lossOrder } from "./content";
import styles from "./landing.module.css";

export default function Safety() {
  return (
    <section id="safety" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>Who pays when a coin sells for less than the balance.</h2>
        <p className={styles.lead}>
          A term ticket is never sold before its due date, so there is no liquidation price. A crash inside the
          term is absorbed in this order, and a loss moves down only when the layer above is used up.
        </p>

        <div className={styles.safetyGrid}>
          <div>
            <h3 className={styles.h3}>The order of loss</h3>
            <ol className={styles.layers}>
              {lossOrder.map((layer) => (
                <li key={layer} className={styles.layer}>
                  <span>{layer}</span>
                </li>
              ))}
            </ol>
            <p className={`${styles.small} ${styles.afterList}`}>
              Staked SCR joins as a layer above depositors once the token launches.
            </p>
          </div>

          <div>
            <h3 className={styles.h3}>What the backtests say</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  {backtests.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backtests.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell) => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`${styles.small} ${styles.afterList}`}>{backtests.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
