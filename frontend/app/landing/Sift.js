import Link from "next/link";
import { usd } from "../../lib/quote";
import { sift } from "./content";
import styles from "./landing.module.css";

// SIFT, inside Trade: the idea, the milestones and the way into the docs. It is the part of
// Sacred that is new, so it sits on its own raised panel.
export default function Sift() {
  return (
    <div id="sift" className={styles.sift}>
      <div className={styles.siftHead}>
        <div>
          <span className={styles.eyebrow}>{sift.eyebrow}</span>
          <h3 className={styles.siftTitle}>{sift.heading}</h3>
        </div>
        <p className={styles.siftLead}>{sift.lead}</p>
      </div>

      <ol className={styles.stages}>
        {sift.milestones.map((m) => (
          <li key={m.when}>
            <span className={styles.stageRule}>{m.when}</span>
            <b>${usd(m.ceiling, 0)}</b>
          </li>
        ))}
      </ol>
      <p className={styles.stageNote}>{sift.milestoneNote}</p>

      <p className={styles.cuts}>
        {sift.rules} {sift.cuts}
      </p>
      <p className={styles.textLink}>
        <Link href={sift.cta.href}>{sift.cta.label}</Link>
      </p>
    </div>
  );
}
