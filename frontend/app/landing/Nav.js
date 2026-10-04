import Link from "next/link";
import shared from "../shared/shared.module.css";
import { links, nav } from "./content";
import styles from "./landing.module.css";

export default function Nav() {
  return (
    <header className={styles.wrap}>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.brand}>
          Sacred
        </Link>
        <div className={styles.navLinks}>
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        <Link href={links.app} className={`${shared.btn} ${shared.btnPrimary}`}>
          Launch app
        </Link>
      </nav>
    </header>
  );
}
