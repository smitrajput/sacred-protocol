import Link from "next/link";
import shared from "../shared/shared.module.css";
import styles from "./landing.module.css";
import Linked from "./Linked";

// One product on the landing page. All three take this shape, so none outranks another: the
// promise and its answers on one side, a worked example on the other, one action beneath.
// `after` runs full width below them, for what belongs to this product alone.
export default function ProductSection({ product, reverse = false, after, children }) {
  const { id, eyebrow, heading, lead, facts, cta } = product;
  return (
    <section id={id} className={styles.section}>
      <div className={`${styles.wrap} ${styles.product}`} data-reverse={reverse || undefined}>
        <div>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2 className={styles.h2}>{heading}</h2>
          <p className={styles.lead}>{lead}</p>
          <dl className={styles.facts}>
            {facts.map(([label, text, link]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <Linked text={text} link={link} />
                </dd>
              </div>
            ))}
          </dl>
          <div className={styles.ctas}>
            <Link href={cta.href} className={`${shared.btn} ${shared.btnGhost}`} data-track="interest" data-product={id}>
              {cta.label}
            </Link>
          </div>
        </div>
        <div className={styles.productPanel}>{children}</div>
      </div>
      {after && <div className={styles.wrap}>{after}</div>}
    </section>
  );
}
