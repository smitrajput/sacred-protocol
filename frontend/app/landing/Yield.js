import { flow } from "./content";
import styles from "./landing.module.css";

// How a deposit becomes yield: the five stops a dollar makes.
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
      </div>
    </section>
  );
}
