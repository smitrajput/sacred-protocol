import Link from "next/link";
import { dials, flow, links, proposed } from "./content";
import styles from "./landing.module.css";

// How a deposit becomes yield: the five stops a dollar makes, then the dials that set the rate.
export default function Yield() {
  return (
    <section id="yield" className={styles.section}>
      <div className={styles.wrap}>
        <span className={styles.eyebrow}>For depositors</span>
        <h2 className={styles.h2}>How the yield is made.</h2>
        <p className={styles.lead}>
          No one is lent anything. Your USDC buys a crypto asset, BTC or ETH, held like a commodity; a trader buys that asset from the vault on credit at a
          markup, and the markup is paid to you. Here is the path one dollar takes.
        </p>

        <ol className={styles.flow}>
          {flow.map((stop) => (
            <li key={stop.title} className={styles.stop}>
              <span className={styles.stopTitle}>{stop.title}</span>
              <span className={styles.stopText}>{stop.text}</span>
            </li>
          ))}
        </ol>

        <div className={styles.twoUp}>
          <div>
            <h3 className={styles.h3}>In numbers</h3>
            <p className={`${styles.body} ${styles.afterList}`}>
              100,000 USDC in a vault that is 85% financed at 17% a year earns 14,450 of markup. 12,282 of it is the
              depositors&rsquo;, a 12.3% return. The {proposed.targetPayout} target is paid out, and the rest fills a
              payout reserve for the months the desks are quiet, so the payout holds in a bear market too. Once the
              reserve is full, the surplus is split equally between depositors and the manager.
            </p>
            <p className={`${styles.small} ${styles.afterList}`}>
              Arithmetic on the launch values, not a forecast. The simulation behind them is in the{" "}
              <Link href={`${links.docs}/economics`}>docs</Link>.
            </p>
          </div>

          <dl className={styles.dials}>
            {dials.map((d) => (
              <div key={d.name} className={styles.dial}>
                <dt>{d.name}</dt>
                <dd>
                  <b>{d.value}</b> {d.note}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
