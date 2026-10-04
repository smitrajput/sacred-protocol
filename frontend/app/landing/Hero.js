import Link from "next/link";
import shared from "../shared/shared.module.css";
import { exampleCoin, links } from "./content";
import styles from "./landing.module.css";
import Ticket from "./Ticket";

export default function Hero({ price }) {
  return (
    <section className={`${styles.wrap} ${styles.hero}`}>
      <div>
        <h1 className={styles.h1}>Do not lend. Sell.</h1>
        <p className={styles.heroLead}>
          Halal leverage for traders and real yield for depositors, built on a sale instead of a loan. No interest
          anywhere.
        </p>
        <div className={styles.ctas}>
          <Link href={links.app} className={`${shared.btn} ${shared.btnPrimary}`}>
            Launch app
          </Link>
          <a href={links.lightpaper} className={`${shared.btn} ${shared.btnGhost}`}>
            Read the lightpaper
          </a>
        </div>
      </div>
      <Ticket coin={exampleCoin} price={price} />
    </section>
  );
}
