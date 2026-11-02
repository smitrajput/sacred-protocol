import { EARN } from "../../lib/params";
import { pct } from "../../lib/quote";
import shared from "../shared/shared.module.css";
import { borrow } from "./content";
import styles from "./landing.module.css";

// The worked examples beside Earn and Borrow. Trade's is the interactive TradeQuote.

export function EarnPanel() {
  return (
    <div className={shared.paper}>
      <div className={shared.head}>
        <h3 className={shared.title}>Modeled return</h3>
        <span className={shared.sub}>$10m of deposits</span>
      </div>
      <table className={styles.quoteTable}>
        <thead>
          <tr>
            <th scope="col">Demand</th>
            <th scope="col">Vault in use</th>
            <th scope="col">APY</th>
          </tr>
        </thead>
        <tbody>
          {EARN.cases.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td>{pct(c.use, 0)}</td>
              <td>
                <b>{pct(c.apy, 2)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={shared.note}>
        Scenarios, not forecasts. APY assumes reinvestment every 14 days, before any loss that reaches principal. Weak
        demand uses the proposed 70% share. A small first pilot would earn less, about 3.85% a year fully used.
      </p>
    </div>
  );
}

export function BorrowPanel() {
  return (
    <div className={shared.paper}>
      <div className={shared.head}>
        <h3 className={shared.title}>From collateral to cash, and back</h3>
      </div>
      <ol className={styles.flowList}>
        {borrow.flow.map((step) => (
          <li key={step.label}>
            <span>{step.label}</span>
            <b>{step.value}</b>
            <small>{step.note}</small>
          </li>
        ))}
      </ol>
      <p className={shared.note}>{borrow.flowNote}</p>
    </div>
  );
}
