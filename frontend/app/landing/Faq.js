import Link from "next/link";
import { faq, links } from "./content";
import styles from "./landing.module.css";
import Linked from "./Linked";

// Short answers to the questions people ask first, in groups. Every answer is folded until its
// question is opened, and opening one closes the others, so the section stays a list of
// questions. `groups` narrows it on a product page.
export default function Faq({ groups }) {
  const shown = groups ? faq.filter((g) => groups.includes(g.group)) : faq;
  return (
    <section id="faq" className={styles.section}>
      <div className={`${styles.wrap} ${styles.faq}`}>
        <div className={styles.faqIntro}>
          <h2 className={styles.h2}>FAQ.</h2>
          <p className={styles.small}>
            The full answers, with the numbers behind them, are in the <Link href={links.docs}>docs</Link>.
          </p>
        </div>

        <div>
          {shown.map((g) => (
            <div key={g.group} className={styles.faqGroup}>
              <h3 className={styles.faqLabel}>{g.group}</h3>
              {g.items.map((item) => (
                <details key={item.q} name="faq" className={styles.faqItem}>
                  <summary className={styles.faqQ}>{item.q}</summary>
                  <p className={styles.faqA}>
                    <Linked text={item.a} link={item.link} />
                  </p>
                </details>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
