"use client";

import { useState } from "react";
import { maxUint256 } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { coinDecimals, coinSymbol, desk, oracle, preview, usdc } from "../../lib/contracts";
import { DESK_DEFAULTS, MAX_LEVERAGE_BPS, leverageLabel, leverageOptions } from "../../lib/defaults";
import { formatAmount, formatUsdc, parseUsdc, quantityAt, quote } from "../../lib/math";
import { formatPrice, priceToUnits } from "../../lib/price";
import Row from "../shared/Row";
import Segmented from "../shared/Segmented";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import useAction from "./useAction";

const REFRESH = { refetchInterval: 8_000 };
const TERMS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
];

export default function OrderForm({ address, spotPrice }) {
  const { run, busy, error } = useAction();
  const [down, setDown] = useState("1000");
  const [chosenLeverage, setLeverageBps] = useState(20_000n);
  const [termDays, setTermDays] = useState(14);

  // Rates and the leverage cap: the Desk's live parameters, or its defaults in preview.
  const { data: params } = useReadContracts({
    contracts: [
      { ...desk, functionName: "baseRateBps" },
      { ...desk, functionName: "surchargeBps" },
      { ...desk, functionName: "surchargeAboveBps" },
      { ...desk, functionName: "maxLeverageBps" },
    ],
    query: { enabled: !preview, ...REFRESH },
  });
  const [baseRateBps, surchargeBps, surchargeAboveBps, maxLeverageBps] = preview
    ? [DESK_DEFAULTS.baseRateBps, DESK_DEFAULTS.surchargeBps, DESK_DEFAULTS.surchargeAboveBps, MAX_LEVERAGE_BPS[coinSymbol]]
    : (params || []).map((d) => d.result);
  const { data: allowance } = useReadContract({
    ...usdc,
    functionName: "allowance",
    args: [address, desk.address],
    query: { enabled: !preview && !!address, ...REFRESH },
  });

  const leverages = leverageOptions(maxLeverageBps ?? 30_000n);
  const leverageBps = leverages.includes(chosenLeverage) ? chosenLeverage : leverages[leverages.length - 1];
  const downPayment = parseUsdc(down);
  const valid = downPayment !== null && downPayment >= DESK_DEFAULTS.minDownPayment;
  const q =
    valid && baseRateBps !== undefined
      ? quote({ downPayment, leverageBps, termDays, baseRateBps, surchargeBps, surchargeAboveBps })
      : null;
  const quantity = q && spotPrice ? quantityAt(q.cost, priceToUnits(spotPrice), coinDecimals) : null;

  // The trader's price limit: accept at most 0.3% less coin than the feed price implies.
  const { data: fairQty } = useReadContract({
    ...oracle,
    functionName: "quantity",
    args: [q?.cost ?? 0n],
    query: { enabled: !preview && !!q },
  });
  const minCoinOut = fairQty ? (fairQty * 9_970n) / 10_000n : 0n;
  const approve = { ...usdc, functionName: "approve", args: [desk.address, maxUint256] };

  const amount = (units) => (q ? formatUsdc(units) : "0.00");
  const hint = preview
    ? "Opening tickets switches on once the contracts are deployed."
    : !address
      ? "Connect a wallet to open a ticket."
      : null;

  return (
    <section className={shared.paper}>
      <div className={shared.head}>
        <h2 className={shared.title}>Buy {coinSymbol} now, pay the rest later</h2>
        {spotPrice && (
          <span className={shared.sub}>
            {coinSymbol} at {formatPrice(spotPrice)} USDC
          </span>
        )}
      </div>

      <div className={styles.form}>
        <label className={`${shared.field} ${styles.wide}`}>
          <span className={shared.label}>Down payment, USDC</span>
          <input
            className={shared.input}
            inputMode="decimal"
            value={down}
            onChange={(e) => setDown(e.target.value)}
            aria-invalid={!valid}
          />
          {!valid && <span className={shared.label}>At least 100 USDC.</span>}
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
        <Row label={`The vault buys ${coinSymbol} for`} value={amount(q?.cost)} />
        {quantity !== null && (
          <Row label={`At ${formatPrice(spotPrice)}, that is`} value={`${formatAmount(quantity, coinDecimals, 4)} ${coinSymbol}`} />
        )}
        <Row label="Your down payment" value={amount(downPayment)} />
        <Row label="The vault finances" value={amount(q?.financed)} />
        <Row label={`Markup, fixed once at ${q ? Number(q.rateBps) / 100 : 0}% a year`} value={amount(q?.markup)} />
        <Row label={`You owe in ${termDays} days`} value={amount(q?.balance)} total />
      </dl>

      <p className={shared.note}>
        The markup is the only charge and it never grows. Leave early and you pay only for the days used. If the
        ticket ends in profit you keep 70% and 30% goes to the backstop fund. A price drop never closes your
        position before the due date.
      </p>

      <div className={styles.actions}>
        <button
          className={shared.inkBtn}
          disabled={preview || !address || !q || busy}
          onClick={() =>
            run(...(allowance >= downPayment ? [] : [approve]), {
              ...desk,
              functionName: "open",
              args: [downPayment, leverageBps, BigInt(termDays) * 86_400n, minCoinOut],
            })
          }
        >
          Open ticket
        </button>
        {hint && <span className={shared.hint}>{hint}</span>}
      </div>
      {error && <p className={shared.warn}>{error}</p>}
    </section>
  );
}
