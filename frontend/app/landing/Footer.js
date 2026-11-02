import Link from "next/link";
import { footer } from "./content";
import styles from "./landing.module.css";

export default function Footer() {
  return (
    <footer className={styles.wrap}>
      <div className={styles.footer}>
        <p>{footer.note}</p>
        <div className={styles.footerLinks}>
          {footer.links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
