"use client";

import { useId, useState } from "react";
import { MAX_LEVERAGE_BPS, leverageLabel, leverageOptions } from "../../lib/defaults";
import { exitPreview, formatAmount, formatUsdc, parseUsdc, quantityAt, quote } from "../../lib/math";
import { formatPrice, priceToUnits } from "../../lib/price";
import Row from "../shared/Row";
import Segmented from "../shared/Segmented";
import shared from "../shared/shared.module.css";
import styles from "./Position.module.css";

const ASSET_DECIMALS = 18;
const TERMS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
];
const MOVE_RANGE = 60; // the price slider runs from -60% to +60%

// A worked position the visitor can change. Every figure is computed by lib/math.js, the same
// arithmetic the app uses, so the demonstration and the product cannot disagree. `price` is
// the asset's spot price in USD, or null when it could not be fetched. `params` is the rate
// card: the Desk's fields plus profitShareBps.
export default function Position({ asset, price, params }) {
  const id = useId();
  const leverages = leverageOptions(MAX_LEVERAGE_BPS[asset]);
  const [down, setDown] = useState("1000");
  const [leverageBps, setLeverageBps] = useState(leverages[leverages.length - 1]);
  const [termDays, setTermDays] = useState(14);
  const [movePct, setMovePct] = useState(20);

  const downPayment = parseUsdc(down);
  const valid = downPayment !== null && downPayment >= params.minDownPayment;
  const q = valid ? quote({ downPayment, leverageBps, termDays, ...params }) : null;

  // Held to the due date the whole markup is earned, so the balance is what the asset must cover.
  const assetValue = q ? (q.cost * BigInt(10_000 + movePct * 100)) / 10_000n : 0n;
  const exit = q ? exitPreview({ assetValue, settlementAmount: q.balance, paidIn: downPayment, shareBps: params.profitShareBps }) : null;

  const priceUnits = price ? priceToUnits(price) : null;
  const quantity = q && priceUnits ? quantityAt(q.cost, priceUnits, ASSET_DECIMALS) : null;
  const priceAtDue = price ? price * (1 + movePct / 100) : null;

  const amount = (units) => (q ? formatUsdc(units) : "0.00");
  const movedBy = `${movePct > 0 ? "+" : ""}${movePct}%`;

  return (
    <div className={`${shared.paper} ${styles.enter}`}>
      <div className={shared.head}>
        <h3 className={shared.title}>A term position</h3>
        <span className={shared.sub}>{price ? `${asset} at ${formatPrice(price)} USDC` : `${asset}, paid in USDC`}</span>
      </div>

      <div className={styles.controls}>
        <label className={`${shared.field} ${styles.wide}`}>
          <span className={shared.label}>Down payment, USDC</span>
          <input
            className={shared.input}
            inputMode="decimal"
            value={down}
            onChange={(e) => setDown(e.target.value)}
            aria-invalid={!valid}
            aria-describedby={valid ? undefined : `${id}-min`}
          />
          {!valid && (
            <span id={`${id}-min`} className={shared.label}>
              At least 100 USDC.
            </span>
          )}
        </label>
        <Segmented
          legend="Leverage"
          options={leverages.map((bps) => ({ label: leverageLabel(bps), value: bps }))}
          value={leverageBps}
          onChange={setLeverageBps}
        />
        <Segmented legend="Term" options={TERMS} value={termDays} onChange={setTermDays} />
      </div>

      <dl className={shared.rows}>
        <Row label={`The vault buys ${asset} for`} value={amount(q?.cost)} />
        {quantity !== null && (
          <Row label={`At ${formatPrice(price)}, that is`} value={`${formatAmount(quantity, ASSET_DECIMALS, 4)} ${asset}`} />
        )}
        <Row label="Your down payment" value={amount(downPayment)} />
        <Row label="The vault finances" value={amount(q?.financed)} />
        <Row label={`Markup, fixed once at ${q ? Number(q.rateBps) / 100 : 0}% a year`} value={amount(q?.markup)} />
        <Row label={`You owe in ${termDays} days`} value={amount(q?.balance)} total />
      </dl>

      <div className={styles.outcome}>
        <label className={shared.field}>
          <span className={styles.rangeHead}>
            <span>{priceAtDue ? `If ${asset} is ${formatPrice(priceAtDue)} at the due date` : `If ${asset} moves by the due date`}</span>
            <b>{movedBy}</b>
          </span>
          <input
            type="range"
            className={styles.range}
            min={-MOVE_RANGE}
            max={MOVE_RANGE}
            step={1}
            value={movePct}
            onChange={(e) => setMovePct(Number(e.target.value))}
            aria-valuetext={movedBy}
          />
        </label>
        {q && (
          <Outcome
            assetValue={assetValue}
            balance={q.balance}
            downPayment={downPayment}
            exit={exit}
            sharePct={Number(params.profitShareBps) / 100}
          />
        )}
      </div>

      <p className={`${shared.note} ${styles.footnote}`}>
        Rates are the launch parameters, before swap costs. The design is not yet reviewed by a Shariah
        board. Nothing here is a quote or a promise.
      </p>
    </div>
  );
}

// What the trader walks away with, in the three cases the contract distinguishes.
function Outcome({ assetValue, balance, downPayment, exit, sharePct }) {
  const sold = formatUsdc(assetValue);

  if (!exit.canClose) {
    return (
      <p className={styles.result}>
        The asset sells for <b>{sold}</b>, below the balance of <b>{formatUsdc(balance)}</b>.{" "}
        <span className={styles.loss}>You lose your down payment of {formatUsdc(downPayment)}</span> and owe nothing
        more. The bucket absorbs the remaining <b>{formatUsdc(balance - assetValue)}</b>.
      </p>
    );
  }

  if (exit.profit === 0n) {
    return (
      <p className={styles.result}>
        The asset sells for <b>{sold}</b>. You take home <b>{formatUsdc(exit.toTrader)}</b>,{" "}
        <span className={styles.loss}>a loss of {formatUsdc(downPayment - exit.toTrader)}</span>. Nothing is
        shared.
      </p>
    );
  }

  return (
    <p className={styles.result}>
      The asset sells for <b>{sold}</b>. You take home <b>{formatUsdc(exit.toTrader)}</b>, a gain of{" "}
      <b>{formatUsdc(exit.toTrader - downPayment)}</b> on your down payment. The backstop fund receives{" "}
      <b>{formatUsdc(exit.toFund)}</b>, {sharePct}% of the profit.
    </p>
  );
}
