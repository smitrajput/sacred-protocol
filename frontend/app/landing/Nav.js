"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import Brand from "../shared/Brand";
import shared from "../shared/shared.module.css";
import { action, links, nav, resources } from "./content";
import styles from "./landing.module.css";

// The bar: the three jobs and FAQ, with the rest under Resources. Under 900px it folds
// into one menu. Escape closes whatever is open, and focus returns to its button.
export default function Nav({ signupHref = action.primary.href }) {
  const menuId = useId();
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const menuButton = useRef(null);
  const moreRoot = useRef(null);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape") return;
      if (menu) menuButton.current?.focus();
      setMenu(false);
      setMore(false);
    }
    function onClick(event) {
      if (!moreRoot.current?.contains(event.target)) setMore(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [menu]);

  const close = () => {
    setMenu(false);
    setMore(false);
  };

  // Launch app is a plain anchor: /app redirects off-site, so it needs a full navigation.
  const primary = (
    <a href={links.app} className={`${shared.btn} ${shared.btnPrimary}`} onClick={close}>
      Launch app
    </a>
  );
  const interest = (extra = "") => (
    <Link href={signupHref} className={`${shared.btn} ${shared.btnGhost}${extra}`} data-track="interest" onClick={close}>
      {action.primary.label}
    </Link>
  );

  return (
    <header className={styles.wrap}>
      <nav className={styles.nav} aria-label="Main">
        <Brand className={styles.brand} />

        <div className={styles.navLinks}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <div className={styles.navMore} ref={moreRoot}>
            <button type="button" aria-expanded={more} aria-controls={`${menuId}-resources`} onClick={() => setMore((open) => !open)}>
              Resources
              <span aria-hidden="true" className={styles.navCaret} data-open={more || undefined} />
            </button>
            <ul id={`${menuId}-resources`} className={styles.navPanel} hidden={!more}>
              {resources.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={close}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.navActions}>
          {action.secondary && (
            <Link href={action.secondary.href} className={`${shared.btn} ${shared.btnGhost} ${styles.navSecondary}`}>
              {action.secondary.label}
            </Link>
          )}
          {interest(` ${styles.navSecondary}`)}
          {primary}
          <button
            ref={menuButton}
            type="button"
            className={styles.menuButton}
            aria-expanded={menu}
            aria-controls={menuId}
            aria-label={menu ? "Close menu" : "Open menu"}
            onClick={() => setMenu((open) => !open)}
          >
            <span aria-hidden="true" data-open={menu || undefined} />
          </button>
        </div>
      </nav>

      <div id={menuId} className={styles.mobileMenu} hidden={!menu}>
        <ul>
          {nav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={close}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className={styles.mobileLabel}>Resources</p>
        <ul>
          {resources.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={close}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        {action.secondary && (
          <Link href={action.secondary.href} className={`${shared.btn} ${shared.btnGhost}`} onClick={close}>
            {action.secondary.label}
          </Link>
        )}
        {interest()}
      </div>
    </header>
  );
}
