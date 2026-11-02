import Link from "next/link";
import shared from "../shared/shared.module.css";
import Faq from "./Faq";
import Footer from "./Footer";
import Funding from "./Funding";
import styles from "./landing.module.css";
import Nav from "./Nav";
import Sift from "./Sift";
import Tracker from "./Tracker";
import Waitlist from "./Waitlist";

// One acquisition page. Copy comes from productPages.js; `panel` is the same worked example the
// landing page shows, so the two cannot disagree. Signups here are attributed to this page and
// preselect its product.
export default function ProductPage({ page, panel }) {
  const { id, eyebrow, heading, lead, notice, cta, steps, details, risks, docs, faq, sift } = page;
  return (
    <>
      <Tracker page={id} />
      <Nav signupHref="#signup" />
      <main>
        <section className={`${styles.wrap} ${styles.pageHero}`}>
          <div>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.h1}>{heading}</h1>
            <p className={styles.lead}>{lead}</p>
            <div className={styles.ctas}>
              <a href="#signup" className={`${shared.btn} ${shared.btnPrimary}`} data-track="interest" data-product={id}>
                {cta}
              </a>
              <Link href={docs.href} className={`${shared.btn} ${shared.btnGhost}`}>
                {docs.label}
              </Link>
            </div>
            <span className={styles.notice}>{notice}</span>
          </div>
          <div>{panel}</div>
        </section>

        <section className={styles.section}>
          <div className={styles.wrap}>
            <h2 className={styles.h2}>{steps.heading}</h2>
            <ol className={styles.flow}>
              {steps.items.map((step) => (
                <li key={step.title} className={styles.stop}>
                  <span className={styles.stopTitle}>{step.title}</span>
                  <span className={styles.stopText}>{step.text}</span>
                </li>
              ))}
            </ol>
            {sift && <Sift />}
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.wrap} ${styles.twoUp}`}>
            <div>
              <h2 className={styles.h2}>{details.heading}</h2>
              <table className={styles.detailTable}>
                <tbody>
                  {details.rows.map(([label, text]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2 className={styles.h2}>{risks.heading}</h2>
              <ul className={styles.riskList}>
                {risks.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Funding />
        <Faq groups={faq} />
        <Waitlist source={id} preselect={[id]} />
      </main>
      <Footer />
    </>
  );
}
