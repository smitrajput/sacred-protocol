import styles from "./app.module.css";

// One figure in a panel's row of figures: a small label over a bold number.
export default function Stat({ label, children }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
