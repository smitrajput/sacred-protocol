"use client";

import { useState } from "react";
import { DAY } from "../../lib/math";
import { formatPrice, priceToUnits } from "../../lib/price";
import { START_PRICE } from "../../lib/sim.js";
import { presenter, useChain } from "../../lib/store.js";
import { formatMoment } from "./format";
import demo from "./demo.module.css";

// The presenter's controls, opened with the backtick key: what a live chain does on its own
// (prices move, days pass, the keeper runs the cut-off and settles due positions), on demand.
const PRICES = [
  ["-30%", 0.7],
  ["-10%", 0.9],
  ["Start", 1],
  ["+10%", 1.1],
  ["+30%", 1.3],
];

export default function Presenter({ me, showBadge, onToggleBadge, onClose }) {
  const s = useChain();
  const [custom, setCustom] = useState("");
  const start = Number(START_PRICE) / 1e6;
  const price = Number(s.price) / 1e6;

  return (
    <aside className={demo.presenter}>
      <div className={demo.presenterHead}>
        <b>Presenter</b>
        <button className={demo.link} onClick={onClose}>
          close (`)
        </button>
      </div>

      <p className={demo.line}>
        {formatMoment(s.now)} · MON {formatPrice(price)}
      </p>

      <div className={demo.group}>
        <span className={demo.groupLabel}>MON price</span>
        <div className={demo.buttons}>
          {PRICES.map(([label, k]) => (
            <button key={label} onClick={() => presenter.setPrice(priceToUnits(start * k))}>
              {label}
            </button>
          ))}
        </div>
        <form
          className={demo.buttons}
          onSubmit={(e) => {
            e.preventDefault();
            const p = Number(custom);
            if (p > 0) presenter.setPrice(priceToUnits(p));
          }}
        >
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="0.0300" inputMode="decimal" />
          <button type="submit">Set</button>
        </form>
      </div>

      <div className={demo.group}>
        <span className={demo.groupLabel}>Time</span>
        <div className={demo.buttons}>
          <button onClick={() => presenter.advance(DAY)}>+1 day</button>
          <button onClick={() => presenter.advance(7n * DAY)}>+7 days</button>
          <button onClick={() => presenter.advance(15n * DAY)}>+15 days</button>
        </div>
      </div>

      <div className={demo.group}>
        <span className={demo.groupLabel}>Keeper</span>
        <div className={demo.buttons}>
          <button onClick={() => presenter.cutoff()}>Run weekly cut-off</button>
          <button onClick={() => presenter.settleDue(me)}>Settle due positions</button>
        </div>
      </div>

      <div className={demo.group}>
        <div className={demo.buttons}>
          <button onClick={onToggleBadge}>{showBadge ? "Hide" : "Show"} demo badge</button>
          <button onClick={() => presenter.reset()}>Reset demo</button>
        </div>
      </div>
    </aside>
  );
}
