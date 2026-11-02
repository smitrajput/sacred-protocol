"use client";

import { useEffect, useState } from "react";
import { campaignFromUrl } from "../../lib/funnel";
import shared from "../shared/shared.module.css";
import { signup } from "./content";
import styles from "./landing.module.css";

// Early access, and the first research instrument: email first, what the person wants to do, and
// afterwards three optional questions. `source` says which page they signed up on, and a product
// page preselects its own product. A ?ref= code in the URL is kept and sent along.
export default function Waitlist({ source = "home", preselect = [] }) {
  const [interests, setInterests] = useState(preselect);
  const [ref, setRef] = useState("");
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) setRef(code.toLowerCase());
  }, []);

  function toggle(value) {
    setInterests((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
  }

  async function submit(event) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, interests, source, campaign: campaignFromUrl(), ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setState({ status: "done", code: data.code, email });
    } catch (e) {
      setState({ status: "error", error: e.message });
    }
  }

  return (
    <section id="signup" className={styles.section}>
      <div className={`${styles.wrap} ${styles.waitlist}`}>
        <div>
          <h2 className={styles.h2}>{signup.heading}</h2>
          <p className={styles.lead}>{signup.lead}</p>
          <p className={`${styles.small} ${styles.afterList}`}>{signup.availability}</p>
          <ul className={styles.otherLinks}>
            {signup.others.map((link) => (
              <li key={link.label}>
                <a href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {state.status === "done" ? (
          <Followup email={state.email} code={state.code} />
        ) : (
          <form className={`${shared.paper} ${styles.waitlistForm}`} onSubmit={submit}>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="wl-email">
                Email
              </label>
              <input id="wl-email" name="email" type="email" required autoComplete="email" className={shared.input} placeholder="you@example.com" />
            </div>
            <fieldset className={shared.field}>
              <legend className={shared.label}>{signup.question}</legend>
              <div className={styles.multi}>
                {signup.interests.map((option) => (
                  <label key={option.value}>
                    <input type="checkbox" checked={interests.includes(option.value)} onChange={() => toggle(option.value)} />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {ref ? <p className={shared.hint}>Joining through a friend&rsquo;s link.</p> : null}
            {state.status === "error" ? <p className={shared.warn}>{state.error}</p> : null}
            <button type="submit" className={shared.inkBtn} disabled={state.status === "sending"}>
              {state.status === "sending" ? "Joining…" : "Get early access"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

// After signup: three optional questions, and a link to pass on.
function Followup({ email, code }) {
  const [device, setDevice] = useState("");
  const [state, setState] = useState("idle");
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/?ref=${code}`;

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code, country: form.get("country"), funding: form.get("funding"), device }),
      });
      if (!res.ok) throw new Error();
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className={`${shared.paper} ${styles.waitlistDone}`} role="status">
      <div className={shared.head}>
        <span className={shared.title}>You are on the list.</span>
      </div>

      {state === "saved" ? (
        <p className={styles.waitlistCopy}>Thank you. That helps us decide what to build first.</p>
      ) : (
        <form className={styles.waitlistForm} onSubmit={submit}>
          <p className={styles.waitlistCopy}>Three optional questions, so we can open in the right places first.</p>
          <div className={styles.waitlistPair}>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="wl-country">
                Country
              </label>
              <input id="wl-country" name="country" autoComplete="country-name" maxLength={60} className={shared.input} />
            </div>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="wl-funding">
                Current exchange or wallet
              </label>
              <select id="wl-funding" name="funding" className={shared.input} defaultValue="">
                <option value="">Choose one</option>
                {signup.sources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <fieldset className={shared.field}>
            <legend className={shared.label}>Preferred device</legend>
            <div className={styles.multi}>
              {signup.devices.map((d) => (
                <label key={d}>
                  <input type="radio" name="device" checked={device === d} onChange={() => setDevice(d)} />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
          {state === "error" ? <p className={shared.warn}>That did not save. Try again.</p> : null}
          <button type="submit" className={`${shared.inkBtn} ${shared.inkBtnGhost}`} disabled={state === "sending"}>
            {state === "sending" ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      <div className={styles.waitlistShare}>
        <p className={shared.label}>Know someone who should see this? Your link:</p>
        <div className={styles.waitlistLink}>
          <input className={shared.input} readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Your link" />
          <button type="button" className={shared.inkBtn} onClick={() => navigator.clipboard?.writeText(link)}>
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
