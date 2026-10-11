"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./docs.module.css";
import { sections } from "./nav";

// The table of contents. On a wide screen it is a sticky column; on a phone it folds behind
// a button that shows the current page's title.
export default function DocsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = sections.flatMap((s) => s.pages).find((p) => `/docs${p.slug ? `/${p.slug}` : ""}` === pathname);

  return (
    <nav className={styles.side} aria-label="Docs">
      <button type="button" className={styles.sideToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{current?.title ?? "Contents"}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div className={styles.sideList} data-open={open || undefined}>
        {sections.map((section) => (
          <div key={section.title} className={styles.sideGroup}>
            <h2 className={styles.sideTitle}>{section.title}</h2>
            <ul>
              {section.pages.map((page) => {
                const href = `/docs${page.slug ? `/${page.slug}` : ""}`;
                const active = href === pathname;
                return (
                  <li key={href}>
                    <Link href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                      {page.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
