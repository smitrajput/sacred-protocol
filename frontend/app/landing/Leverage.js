import { exampleCoin, modes, proposed, traderSteps } from "./content";
import styles from "./landing.module.css";
import Ticket from "./Ticket";

// How a ticket works from the trader's side, the two kinds of ticket, and a live one to try.
// `price` is the example coin's spot price for the worked ticket, or null if it could not be fetched.
export default function Leverage({ price }) {
  return (
    <section id="leverage" className={styles.section}>
      <div className={styles.wrap}>
        <span className={styles.eyebrow}>For traders</span>
        <h2 className={styles.h2}>Leverage without a loan.</h2>
        <p className={styles.lead}>
          A ticket is a coin bought on credit: you pay part now, the rest by a due date, and the coin stays pledged
          until then. The price is fixed the moment you open it. No funding, no interest, no margin call.
        </p>

        <div className={styles.leverage}>
          <div>
            <ol className={styles.steps}>
              {traderSteps.map((text) => (
                <li key={text} className={styles.step}>
                  <span>{text}</span>
                </li>
              ))}
            </ol>

            <h3 className={`${styles.h3} ${styles.afterRows}`}>Two kinds of ticket.</h3>
            <table className={`${styles.table} ${styles.modes}`}>
              <thead>
                <tr>
                  {modes.columns.map((c, i) => (
                    <th key={i} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modes.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`${styles.small} ${styles.afterList}`}>
              Cover is the coin&rsquo;s value divided by what you owe. A 10x perp is liquidated in full at about a 9%
              fall; a 5x margin ticket sells part of the coin at an 8% fall and leaves you the rest of the position.
            </p>
          </div>

          <div className={styles.ticketCol}>
            <Ticket coin={exampleCoin} price={price} params={proposed} />
            <p className={`${styles.small} ${styles.caption}`}>
              A term ticket at today&rsquo;s {exampleCoin} price. Pick a down payment, a leverage and a term, then
              move the price to the due date. The figures come from the same arithmetic the contracts use.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
