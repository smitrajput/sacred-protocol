"use client";

import { useState } from "react";
import { STATUS, coinDecimals, coinSymbol, desk, preview, usdc } from "../../lib/contracts";
import { exitPreview, formatAmount, formatUsdc, parseUsdc } from "../../lib/math";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import { LIVE, approve, call, unlessAllowed, useTickets, useWallet } from "./data";
import { formatDay } from "./format";
import Stat from "./Stat";
import useAction from "./useAction";

export default function Tickets({ address, sample }) {
  const { run, busy, error } = useAction();
  const [part, setPart] = useState({});
  const { tickets, owed } = useTickets(address, sample);
  const wallet = useWallet(address);
  const canAct = !preview && !!address && !busy;

  // Pay off and part payments pull USDC from the trader, so they may need an approval first.
  const withApproval = (needed, action) => run(...unlessAllowed(wallet.usdcForDesk, needed, approve(usdc, desk)), action);

  return (
    <section className={shared.paper}>
      <div className={shared.head}>
        <h2 className={shared.title}>Your tickets</h2>
        {preview && <span className={shared.sub}>Sample tickets</span>}
      </div>

      {tickets.length === 0 ? (
        <p className={`${shared.hint} ${styles.empty}`}>
          {address ? "No tickets yet. Open one above." : "Connect a wallet to see your tickets."}
        </p>
      ) : (
        <ul className={styles.tickets}>
          {tickets.map((t) => {
            const { settle, value } = t;
            const p =
              settle !== undefined && value !== undefined
                ? exitPreview({ coinValue: value, settlementAmount: settle, paidIn: t.downPayment + t.repaid })
                : null;
            const partAmount = parseUsdc(part[t.id] || "");
            return (
              <li key={t.id} className={styles.ticket} data-ticket={String(t.id)}>
                <div className={styles.ticketHead}>
                  <b>Ticket {String(t.id)}</b>
                  <span className={shared.sub}>
                    {STATUS[t.status]}, {t.status === LIVE ? "due" : "was due"} {formatDay(t.due)}
                  </span>
                </div>
                <dl className={styles.figures}>
                  <Stat label={coinSymbol}>{formatAmount(t.qty ?? 0n, coinDecimals, 4)}</Stat>
                  {settle !== undefined && <Stat label="To settle today">{formatUsdc(settle)}</Stat>}
                  {value !== undefined && <Stat label="Worth now">{formatUsdc(value)}</Stat>}
                  {p && <Stat label="You would get">{p.canClose ? formatUsdc(p.toTrader) : "under water"}</Stat>}
                </dl>
                {t.status === LIVE && (
                  <div className={styles.rowActions}>
                    <button
                      className={shared.inkBtn}
                      disabled={!canAct || !p?.canClose}
                      onClick={() => run(call(desk, "close", t.id, (value * 9_970n) / 10_000n))}
                    >
                      Close
                    </button>
                    <button
                      className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
                      disabled={!canAct || settle === undefined}
                      onClick={() => withApproval(settle + (p?.toFund ?? 0n), call(desk, "payOff", t.id))}
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
                      onClick={() => withApproval(partAmount, call(desk, "partPay", t.id, partAmount))}
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
          <button className={shared.inkBtn} disabled={!canAct} onClick={() => run(call(desk, "claimOwed"))}>
            Collect
          </button>
        </div>
      )}
      {error && <p className={shared.warn}>{error}</p>}
    </section>
  );
}
