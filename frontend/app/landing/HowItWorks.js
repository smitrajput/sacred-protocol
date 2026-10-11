import { contracts, exampleCoin, steps } from "./content";
import styles from "./landing.module.css";
import Ticket from "./Ticket";

// `price` is the example coin's spot price for the worked ticket, or null if it could not be fetched.
export default function HowItWorks({ price }) {
  return (
    <section id="how" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>One purchase, financed by a sale.</h2>
        <p className={styles.lead}>
          A vault of depositors&rsquo; USDC buys a real coin and sells it to the trader at cost plus a fixed markup.
          The trader pays part now and the rest by a due date. The coin stays pledged until then. There is no loan
          anywhere, so there is no interest.
        </p>

        <div className={styles.how}>
          <div>
            <ol className={styles.steps}>
              {steps.map((text) => (
                <li key={text} className={styles.step}>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <p className={`${styles.small} ${styles.caption}`}>
              Steps 1 to 3 happen in a single transaction. The vault owns the coin before it sells it, every time.
            </p>
          </div>

          <div>
            <h3 className={styles.h3}>Three contracts Muslims have used for centuries.</h3>
            <div className={`${styles.contractRows} ${styles.afterList}`}>
              {contracts.map((c) => (
                <div key={c.name} className={styles.contractRow}>
                  <span className={styles.contractName}>{c.name}</span>
                  <span className={styles.contractBetween}>{c.between}</span>
                  <span className={styles.contractLine}>{c.line}</span>
                </div>
              ))}
            </div>
            <p className={`${styles.body} ${styles.afterList}`}>
              The markup traders pay is the depositors&rsquo; yield, all of it. A bucket with 80% of its USDC financed
              at 11% a year earns about 7.9% a year for depositors before any shortfalls. That is arithmetic on
              proposed values, not a forecast.
            </p>
          </div>
        </div>

        <div className={styles.tryTicket}>
          <div>
            <h3 className={styles.h3}>Work one through.</h3>
            <p className={`${styles.body} ${styles.afterList}`}>
              Pick a down payment, a leverage and a term, then move the price to the due date. The figures come
              from the same arithmetic the app and the contracts use, at today&rsquo;s {exampleCoin} price.
            </p>
            <p className={`${styles.body} ${styles.afterList}`}>
              The balance is fixed the moment the ticket opens. If the coin falls below it, the most you can lose
              is your down payment.
            </p>
          </div>
          <Ticket coin={exampleCoin} price={price} />
        </div>
      </div>
    </section>
  );
}
