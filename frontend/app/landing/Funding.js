import Link from "next/link";
import { funding } from "./content";
import styles from "./landing.module.css";

// How money gets in: three steps, then the routes, with the exact support table in the docs.
export default function Funding() {
  return (
    <section id="funding" className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.h2}>{funding.heading}</h2>
        <ol className={styles.flow}>
          {funding.steps.map((step) => (
            <li key={step.title} className={styles.stop}>
              <span className={styles.stopTitle}>{step.title}</span>
              <span className={styles.stopText}>{step.text}</span>
            </li>
          ))}
        </ol>
        <div className={styles.routes}>
          {funding.routes.map((route) => (
            <div key={route.group}>
              <h3 className={styles.routeLabel}>{route.group}</h3>
              <ul className={styles.chips}>
                {route.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className={styles.small}>{route.note}</p>
            </div>
          ))}
        </div>
        <p className={styles.textLink}>
          <Link href={funding.link.href}>{funding.link.label}</Link>
        </p>
      </div>
    </section>
  );
}
