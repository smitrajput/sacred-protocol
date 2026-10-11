"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./docs.module.css";
import { pages } from "./nav";

// Previous and next page in reading order, under the article.
export default function DocsPager() {
  const pathname = usePathname();
  const i = pages.findIndex((p) => p.href === pathname);
  if (i < 0) return null;
  const prev = pages[i - 1];
  const next = pages[i + 1];
  return (
    <nav className={styles.pager} aria-label="Previous and next">
      {prev ? (
        <Link href={prev.href} className={styles.pagerLink}>
          <small>Previous</small>
          <span>{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className={`${styles.pagerLink} ${styles.pagerNext}`}>
          <small>Next</small>
          <span>{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
