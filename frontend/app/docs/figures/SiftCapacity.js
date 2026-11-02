"use client";

import { useState } from "react";
import { SIFT } from "../../../lib/params";
import { effectiveCeiling, newFinancing, siftCeiling, usd } from "../../../lib/quote";
import Segmented from "../../shared/Segmented";
import shared from "../../shared/shared.module.css";
import styles from "./SiftCapacity.module.css";

// What the curve means for one account at 2×: qualifying days earn a ceiling, the vault caps it at
// 1% of NAV, and new financing stays bounded by the trader's own fresh capital. An illustration of
// the headroom rule, with nothing outstanding and every other gate passing.

const VAULTS = [
  { label: "$1m", value: 1_000_000 },
  { label: "$5m", value: 5_000_000 },
  { label: "$10m", value: 10_000_000 },
];

const LAST_DAY = SIFT.schedule.length - 1;

export default function SiftCapacity() {
  const [day, setDay] = useState(14);
  const [capital, setCapital] = useState(5_000);
  const [nav, setNav] = useState(VAULTS[1].value);

  const curve = siftCeiling(day);
  const ceiling = effectiveCeiling({ q: day, nav });
  const r = newFinancing({ ceiling, freshCapital: capital });
  const vault = SIFT.navCap * nav;
  const top = Math.max(curve, vault, r.capitalBound);
  const width = (n) => `${(n / top) * 100}%`;

  const binding = r.binding === "capital" ? "Your capital binds" : ceiling < curve ? "The vault binds" : "The curve binds";

  const rows = [
    ["Earned ceiling", curve],
    ["Allowed by the vault", vault],
    ["Supported by your capital", r.capitalBound],
    ["Maximum new financing", r.financing],
  ];

  return (
    <div className={`${shared.paper} ${styles.panel}`}>
      <div className={shared.head}>
        <h3 className={shared.title}>Financing capacity</h3>
        <span className={shared.sub}>2×, no open positions</span>
      </div>

      <div className={styles.controls}>
        <label className={shared.field}>
          <span className={styles.rangeHead}>
            <span>Qualifying days</span>
            <b>{day}</b>
          </span>
          <input
            type="range"
            min={0}
            max={LAST_DAY}
            step={1}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className={styles.range}
            aria-valuetext={`${day} qualifying days`}
          />
        </label>
        <label className={shared.field}>
          <span className={styles.rangeHead}>
            <span>Fresh capital</span>
            <b>{usd(capital, 0)} USDC</b>
          </span>
          <input
            type="range"
            min={500}
            max={SIFT.accountCap}
            step={500}
            value={capital}
            onChange={(e) => setCapital(Number(e.target.value))}
            className={styles.range}
            aria-valuetext={`${capital} USDC`}
          />
        </label>
        <Segmented legend="Vault NAV" options={VAULTS} value={nav} onChange={setNav} />
      </div>

      <dl className={styles.bars}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.bar}>
            <dt>{label}</dt>
            <dd>{usd(value, 0)} USDC</dd>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: width(value) }} />
            </span>
          </div>
        ))}
      </dl>

      <p className={styles.result}>
        <b>{binding}.</b> {usd(r.financing, 0)} of financing buys {usd(r.financing * 2, 0)} of asset.
      </p>
      <p className={shared.note}>
        Capital before markup and fees. All other checks assumed to pass. Proposed policy, and the maximum path for a
        qualifying trader.
      </p>
    </div>
  );
}
