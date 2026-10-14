import styles from "./shared.module.css";

// One line of a receipt: label left, figure right. Keyed on the figure so a change replays
// the settle animation.
export default function Row({ label, value, total = false }) {
  return (
    <div className={`${styles.row} ${total ? styles.total : ""}`}>
      <dt>{label}</dt>
      <dd>
        <b key={value} className={styles.value}>
          {value}
        </b>
      </dd>
    </div>
  );
}
