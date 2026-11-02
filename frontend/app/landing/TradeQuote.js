"use client";

import { useState } from "react";
import { LADDER, SIFT } from "../../lib/params";
import { pct, tradeQuote, usd } from "../../lib/quote";
import Row from "../shared/Row";
import shared from "../shared/shared.module.css";
import { higherTiers } from "./content";
import styles from "./landing.module.css";

const ASSETS = ["BTC", "ETH"];

// A compact quote the visitor can change. Every figure comes from lib/quote.js, tested against
// the docs' worked examples. It starts at the largest 2× position a new account can open.
export default function TradeQuote() {
  const [contribution, setContribution] = useState(SIFT.starterCeiling);
  const [rung, setRung] = useState(0);
  const [asset, setAsset] = useState("BTC");
  const tier = LADDER[rung];
  const q = tradeQuote({ contribution, tier });
  const earned = q.financing > SIFT.starterCeiling;

  return (
    <div className={shared.paper}>
      <div className={shared.head}>
        <h3 className={shared.title}>A 14-day quote</h3>
        <div className={shared.seg} role="radiogroup" aria-label="Asset">
          {ASSETS.map((a) => (
            <label key={a} className={styles.assetChoice}>
              <input type="radio" name="trade-asset" checked={asset === a} onChange={() => setAsset(a)} />
              {a}
            </label>
          ))}
        </div>
      </div>

      <label className={`${shared.field} ${styles.slider}`}>
        <span className={styles.sliderHead}>
          <span>Your contribution</span>
          <b>{usd(contribution, 0)} USDC</b>
        </span>
        <input
          type="range"
          min={100}
          max={5_000}
          step={100}
          value={contribution}
          onChange={(e) => setContribution(Number(e.target.value))}
          aria-valuetext={`${contribution} USDC`}
        />
      </label>

      <label className={`${shared.field} ${styles.slider}`}>
        <span className={styles.sliderHead}>
          <span>Leverage</span>
          <b>{tier.leverage}×</b>
        </span>
        <input
          type="range"
          min={0}
          max={LADDER.length - 1}
          step={1}
          value={rung}
          onChange={(e) => setRung(Number(e.target.value))}
          aria-valuetext={`${tier.leverage} times`}
        />
      </label>

      <dl className={shared.rows}>
        <Row label={`${asset} exposure`} value={usd(q.exposure)} />
        <Row label="Financing" value={usd(q.financing)} />
        <Row label="Fixed markup, 14 days" value={usd(q.markup)} />
        <Row label="Estimated execution" value={usd(q.execution)} />
        <Row label="Share of your profit" value="None" />
        <Row label="Total cost at constant price" value={usd(q.totalCost)} total />
      </dl>

      <p className={styles.quoteLine}>
        Part of the position is sold if {asset} falls about <b>{pct(q.priceRoom)}</b>, restoring coverage to{" "}
        {pct(tier.restore, 0)}. You can never owe more than you pledged.
      </p>
      <p className={shared.note}>
        {earned
          ? `This needs $${usd(q.financing, 0)} of earned financing. New accounts start at $${usd(SIFT.starterCeiling, 0)}.`
          : "Within the Starter ceiling for a new account."}{" "}
        {rung > 0 && `${higherTiers} `}Proposed terms. Execution costs are assumptions, not measured fills.
      </p>
    </div>
  );
}
