"use client";

import { useEffect, useState } from "react";
import shared from "../shared/shared.module.css";
import styles from "./landing.module.css";

const ROLES = [
  ["trader", "Trader"],
  ["depositor", "Depositor"],
  ["investor", "Investor"],
  ["builder", "Builder"],
];

// The waitlist: email, and three optional fields that each earn the signup something. A wallet
// puts a trader in line for a seat by their record; a handle counts their reach; a role routes
// investors to a different conversation. A ?ref= code in the URL is kept and sent along.
export default function Waitlist() {
  const [role, setRole] = useState("");
  const [ref, setRef] = useState("");
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) setRef(code.toLowerCase());
  }, []);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), wallet: form.get("wallet"), handle: form.get("handle"), role, ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setState({ status: "done", code: data.code });
    } catch (e) {
      setState({ status: "error", error: e.message });
    }
  }

  const link = state.code ? `${typeof window === "undefined" ? "" : window.location.origin}/?ref=${state.code}` : "";

  return (
    <section id="waitlist" className={styles.section}>
      <div className={`${styles.wrap} ${styles.waitlist}`}>
        <div>
          <h2 className={styles.h2}>Want in early?</h2>
          <p className={styles.lead}>
            I&rsquo;m opening the desk to a small first cohort of depositors and traders, with deposits capped at 1
            million USDC. Leave your email and I&rsquo;ll write when the list opens. Add a wallet if you trade; seats
            go by record, not by follower count.
          </p>
          <p className={`${styles.small} ${styles.afterList}`}>
            Points start on day one for everyone on the list who deposits or trades. They are a discretionary gift and
            promise nothing.
          </p>
        </div>

        {state.status === "done" ? (
          <div className={`${shared.paper} ${styles.waitlistDone}`} role="status">
            <div className={shared.head}>
              <span className={shared.title}>You are on the list.</span>
            </div>
            <p className={styles.waitlistCopy}>
              Your link. Anyone who joins through it counts as yours, and the people who bring the most depositors and
              traders are first in line when the desk opens.
            </p>
            <div className={styles.waitlistLink}>
              <input className={shared.input} readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Your referral link" />
              <button type="button" className={shared.inkBtn} onClick={() => navigator.clipboard?.writeText(link)}>
                Copy
              </button>
            </div>
          </div>
        ) : (
          <form className={`${shared.paper} ${styles.waitlistForm}`} onSubmit={submit}>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="wl-email">
                Email
              </label>
              <input id="wl-email" name="email" type="email" required autoComplete="email" className={shared.input} placeholder="you@example.com" />
            </div>
            <div className={shared.field}>
              <span className={shared.label}>I am a</span>
              <div className={shared.seg} role="radiogroup" aria-label="Role">
                {ROLES.map(([value, label]) => (
                  <label key={value}>
                    <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.waitlistPair}>
              <div className={shared.field}>
                <label className={shared.label} htmlFor="wl-wallet">
                  Wallet <span className={styles.optional}>optional</span>
                </label>
                <input id="wl-wallet" name="wallet" className={shared.input} placeholder="0x…" spellCheck={false} autoComplete="off" />
              </div>
              <div className={shared.field}>
                <label className={shared.label} htmlFor="wl-handle">
                  X handle <span className={styles.optional}>optional</span>
                </label>
                <input id="wl-handle" name="handle" className={shared.input} placeholder="@you" spellCheck={false} autoComplete="off" />
              </div>
            </div>
            {ref ? <p className={shared.hint}>Joining through a friend&rsquo;s link.</p> : null}
            {state.status === "error" ? <p className={shared.warn}>{state.error}</p> : null}
            <button type="submit" className={shared.inkBtn} disabled={state.status === "sending"}>
              {state.status === "sending" ? "Joining…" : "Join the waitlist"}
            </button>
            <p className={shared.note}>One email when the list opens, and nothing else. No sharing, no selling.</p>
          </form>
        )}
      </div>
    </section>
  );
}
