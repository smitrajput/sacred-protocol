import Link from "next/link";
import { backtests, layers, links, system } from "./content";
import styles from "./landing.module.css";

// What a crash meets before it reaches a deposit, each layer defined, and what the backtests say.
export default function Safety() {
  return (
    <section id="safety" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>Solvency Robustness.</h2>
        <p className={styles.lead}>
          A term position is never sold before its due date, so there is no liquidation price. If the asset sells for
          less than the balance, the gap is absorbed in this order, and it moves down only when the layer above is
          used up.
        </p>

        <div className={styles.safetyGrid}>
          <ol className={styles.layers}>
            {layers.map((layer) => (
              <li key={layer.name} className={styles.layer}>
                <span className={styles.layerName}>{layer.name}</span>
                <span className={styles.layerWhat}>{layer.what}</span>
              </li>
            ))}
          </ol>

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
                    {row.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <table className={`${styles.table} ${styles.prose} ${styles.afterRows}`}>
              <thead>
                <tr>
                  {system.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {system.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <p className={`${styles.small} ${styles.afterList}`}>
              {backtests.note} Method and every table are in the <Link href={`${links.docs}/risk`}>docs</Link>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
