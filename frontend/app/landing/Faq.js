import Link from "next/link";
import { faq, links } from "./content";
import styles from "./landing.module.css";

// Short answers to the questions people ask first, in four groups. Every answer is folded
// until its question is opened, and opening one closes the others, so the section stays a
// list of questions.
export default function Faq() {
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
          {faq.map((g) => (
            <div key={g.group} className={styles.faqGroup}>
              <h3 className={styles.faqLabel}>{g.group}</h3>
              {g.items.map((item) => (
                <details key={item.q} name="faq" className={styles.faqItem}>
                  <summary className={styles.faqQ}>{item.q}</summary>
                  <p className={styles.faqA}>{answer(item)}</p>
                </details>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// An answer with one phrase in it linked, when the item names one.
function answer({ a, link }) {
  if (!link) return a;
  const [before, after] = a.split(link.text);
  return (
    <>
      {before}
      <a href={link.href}>{link.text}</a>
      {after}
    </>
  );
}
