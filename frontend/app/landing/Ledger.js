import Link from "next/link";
import { ledger, links } from "./content";
import styles from "./landing.module.css";

// One ticket held to its due date, at every price. The whole risk profile of the product is
// in six rows: the bucket earns the same small markup in five of them and takes the loss in
// the sixth; the trader's loss stops at the down payment.
const sign = (s) => (s.startsWith("−") ? styles.down : s.startsWith("+") ? styles.up : undefined);

export default function Ledger() {
  return (
    <section id="numbers" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>What happens to the numbers.</h2>
        <p className={styles.lead}>
          1,000 USDC down at 3x for 14 days at 11% a year: the vault buys 3,000 of coin, the markup is 8.44, the
          balance 2,008.44. Held to the due date, this is every outcome.
        </p>

        <div className={styles.ledgerScroll}>
          <table className={styles.ledger}>
            <thead>
              <tr>
                {ledger.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((r) => (
                <tr key={r.move}>
                  <td>{r.move}</td>
                  <td>{r.sold}</td>
                  <td>{r.bucket}</td>
                  <td>{r.trader}</td>
                  <td className={sign(r.result)}>{r.result}</td>
                  <td className={sign(r.bucketResult)}>{r.bucketResult}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.ledgerNotes}>
          <p>
            <b>The bucket never earns more than the markup.</b> Its profile is many small gains and a rare larger
            loss. Depositors are paid whether the trader wins or loses.
          </p>
          <p>
            <b>The trader&rsquo;s loss stops at the down payment.</b> In the last row the trader owes nothing more. No
            margin call, no negative balance, no debt collector.
          </p>
          <p>
            <b>The last row is a shortfall.</b> The bucket financed 2,000 and got back 1,800. Who pays the 200, and in
            what order, is <Link href="#safety">below</Link>; the full backtests are in the{" "}
            <Link href={`${links.docs}/risk`}>docs</Link>.
          </p>
        </div>
        <p className={`${styles.small} ${styles.caption}`}>
          Figures from the design document&rsquo;s worked examples, before the trader&rsquo;s 30% profit share and
          before swap costs. In the +20% row the trader keeps 1,414.09 after the share, a gain of 41.4%.
        </p>
      </div>
    </section>
  );
}
