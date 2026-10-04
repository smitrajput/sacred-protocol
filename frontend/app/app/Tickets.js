"use client";

import { useState } from "react";
import { maxUint256 } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { STATUS, coinDecimals, coinSymbol, desk, oracle, preview, usdc } from "../../lib/contracts";
import { exitPreview, formatAmount, formatUsdc, parseUsdc, settlement, valueAt } from "../../lib/math";
import { priceToUnits } from "../../lib/price";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import { formatDay } from "./format";
import useAction from "./useAction";

const REFRESH = { refetchInterval: 8_000 };
const LIVE = 1;

export default function Tickets({ address, sample, spotPrice, now }) {
  const { run, busy, error } = useAction();
  const [part, setPart] = useState({});
  const onChain = !preview && !!address;

  // Every ticket on the desk, filtered to the connected wallet. In preview, the sample ones.
  const { data: nextId } = useReadContract({ ...desk, functionName: "nextId", query: { enabled: onChain, ...REFRESH } });
  const ids = onChain ? Array.from({ length: Number((nextId ?? 1n) - 1n) }, (_, i) => BigInt(i + 1)) : [];
  const { data: raw } = useReadContracts({
    contracts: ids.map((id) => ({ ...desk, functionName: "getTicket", args: [id] })),
    query: { enabled: onChain && ids.length > 0, ...REFRESH },
  });
  const mine = preview
    ? sample.tickets
    : ids.map((id, i) => ({ id, ...(raw?.[i]?.result || {}) })).filter((t) => t.owner?.toLowerCase() === address?.toLowerCase());
  const live = mine.filter((t) => t.status === LIVE);

  // Today's settlement amount and the coin's value for each live ticket: read from the chain,
  // or computed here from the spot price in preview.
  const { data: details } = useReadContracts({
    contracts: live.flatMap((t) => [
      { ...desk, functionName: "settlementAmount", args: [t.id] },
      { ...oracle, functionName: "value", args: [t.qty] },
    ]),
    query: { enabled: onChain && live.length > 0, ...REFRESH },
  });
  const priceUnits = spotPrice ? priceToUnits(spotPrice) : null;
  const figures = (t) => {
    const k = live.findIndex((l) => l.id === t.id);
    if (k < 0) return {};
    if (preview) {
      return {
        settle: settlement(t.financed, t.markup, t.repaid, t.opened, t.due, BigInt(now)),
        value: priceUnits ? valueAt(t.qty, priceUnits, coinDecimals) : undefined,
      };
    }
    return { settle: details?.[2 * k]?.result, value: details?.[2 * k + 1]?.result };
  };

  const { data: owed } = useReadContract({ ...desk, functionName: "owed", args: [address], query: { enabled: onChain, ...REFRESH } });
  const { data: allowance } = useReadContract({
    ...usdc,
    functionName: "allowance",
    args: [address, desk.address],
    query: { enabled: onChain, ...REFRESH },
  });
  const approve = { ...usdc, functionName: "approve", args: [desk.address, maxUint256] };
  const withApproval = (needed, call) => run(...(allowance >= needed ? [] : [approve]), call);
  const canAct = onChain && !busy;

  return (
    <section className={shared.paper}>
      <div className={shared.head}>
        <h2 className={shared.title}>Your tickets</h2>
        {preview && <span className={shared.sub}>Sample tickets</span>}
      </div>

      {mine.length === 0 ? (
        <p className={`${shared.hint} ${styles.empty}`}>
          {address ? "No tickets yet. Open one above." : "Connect a wallet to see your tickets."}
        </p>
      ) : (
        <ul className={styles.tickets}>
          {mine.map((t) => {
            const { settle, value } = figures(t);
            const p =
              settle !== undefined && value !== undefined
                ? exitPreview({ coinValue: value, settlementAmount: settle, paidIn: t.downPayment + t.repaid })
                : null;
            const partAmount = parseUsdc(part[t.id] || "");
            return (
              <li key={t.id} className={styles.ticket}>
                <div className={styles.ticketHead}>
                  <b>Ticket {String(t.id)}</b>
                  <span className={shared.sub}>
                    {STATUS[t.status]}, {t.status === LIVE ? "due" : "was due"} {formatDay(t.due)}
                  </span>
                </div>
                <dl className={styles.figures}>
                  <Figure label={coinSymbol}>{formatAmount(t.qty ?? 0n, coinDecimals, 4)}</Figure>
                  {settle !== undefined && <Figure label="To settle today">{formatUsdc(settle)}</Figure>}
                  {value !== undefined && <Figure label="Worth now">{formatUsdc(value)}</Figure>}
                  {p && <Figure label="You would get">{p.canClose ? formatUsdc(p.toTrader) : "under water"}</Figure>}
                </dl>
                {t.status === LIVE && (
                  <div className={styles.rowActions}>
                    <button
                      className={shared.inkBtn}
                      disabled={!canAct || !p?.canClose}
                      onClick={() => run({ ...desk, functionName: "close", args: [t.id, (value * 9_970n) / 10_000n] })}
                    >
                      Close
                    </button>
                    <button
                      className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
                      disabled={!canAct || settle === undefined}
                      onClick={() => withApproval(settle + (p?.toFund ?? 0n), { ...desk, functionName: "payOff", args: [t.id] })}
                    >
                      Pay off
                    </button>
                    <input
                      className={`${shared.input} ${styles.smallInput}`}
                      inputMode="decimal"
                      placeholder="USDC"
                      aria-label={`Part payment for ticket ${t.id}`}
                      value={part[t.id] || ""}
                      onChange={(e) => setPart({ ...part, [t.id]: e.target.value })}
                    />
                    <button
                      className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
                      disabled={!canAct || !partAmount}
                      onClick={() => withApproval(partAmount, { ...desk, functionName: "partPay", args: [t.id, partAmount] })}
                    >
                      Part pay
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {owed > 0n && (
        <div className={styles.actions}>
          <span>{formatUsdc(owed)} USDC is waiting for you from settled tickets.</span>
          <button className={shared.inkBtn} disabled={!canAct} onClick={() => run({ ...desk, functionName: "claimOwed" })}>
            Collect
          </button>
        </div>
      )}
      {error && <p className={shared.warn}>{error}</p>}
    </section>
  );
}

function Figure({ label, children }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
