"use client";

import { useState } from "react";
import { preview, sale, usdc } from "../../lib/contracts";
import { formatUsdc, parseScr } from "../../lib/math";
import { formatScr, saleCost, withSlack } from "../../lib/scr";
import Row from "../shared/Row";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import { approve, call, unlessAllowed, useSale, useWallet } from "./data";
import Stat from "./Stat";
import useAction from "./useAction";

// The SCR buyer's panel. New SCR is sold for USDC that goes straight to the liquidity reserve,
// and the SCR arrives staked in the backstop fund.
export default function Sale({ address, sample }) {
  const { run, busy, error } = useAction();
  const [amount, setAmount] = useState("");
  const s = useSale(sample);
  const wallet = useWallet(address);

  const scrAmount = parseScr(amount);
  const cost = scrAmount && s.price !== undefined ? saleCost(scrAmount, s.price) : null;
  const maxCost = cost && withSlack(cost);
  const tooMany = scrAmount && s.remaining !== undefined && scrAmount > s.remaining;
  const status = s.paused ? "Paused" : s.open === false ? "Closed, the reserve is at its target" : s.open ? "Open" : "";
  const canAct = !preview && !!address && !busy;
  const hint = preview
    ? "The sale switches on once the contracts are deployed."
    : !address
      ? "Connect a wallet to buy SCR."
      : tooMany
        ? "More than is left this week."
        : null;

  return (
    <section className={shared.paper}>
      <div className={shared.head}>
        <h2 className={shared.title}>Buy SCR from the reserve</h2>
        <span className={shared.sub}>{status}</span>
      </div>

      <dl className={styles.stats}>
        <Stat label="Price per SCR">{formatUsdc(s.price ?? 0n, 4)} USDC</Stat>
        <Stat label="Pool average">{formatUsdc(s.marketPrice ?? 0n, 4)} USDC</Stat>
        <Stat label="Reserve value per SCR">{formatUsdc(s.reserveValue ?? 0n, 4)} USDC</Stat>
        <Stat label="Reserve">
          {formatUsdc(s.reserveAssets ?? 0n, 0)} of {formatUsdc(s.reserveTarget ?? 0n, 0)} USDC
        </Stat>
        <Stat label="Left this week">{formatScr(s.remaining)} SCR</Stat>
      </dl>

      <p className={`${shared.note} ${styles.spaced}`}>
        The price is the higher of the pool&apos;s average less a discount and the reserve&apos;s value per SCR, so a
        sale never lowers that value. Every USDC goes to the liquidity reserve, which steps into a bucket that is
        short of cash for its withdrawals. Sales are open only while the reserve is below its target. Bought SCR
        arrives staked, with the fund&apos;s cooldown.
      </p>

      <div className={styles.form}>
        <label className={`${shared.field} ${styles.wide}`}>
          <span className={shared.label}>Buy, SCR</span>
          <input className={shared.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>

      <dl className={shared.rows}>
        <Row label="You pay, at most 1% above today's price" value={cost ? `${formatUsdc(cost)} USDC` : "0.00 USDC"} />
        <Row label="You receive, staked in the backstop fund" value={`${scrAmount ? formatScr(scrAmount) : "0"} SCR`} total />
      </dl>

      <div className={styles.actions}>
        <button
          className={shared.inkBtn}
          disabled={!canAct || !cost || !s.open || s.paused || tooMany}
          onClick={() => run(...unlessAllowed(wallet.usdcForSale, maxCost, approve(usdc, sale)), call(sale, "buy", scrAmount, maxCost))}
        >
          Buy SCR
        </button>
        {hint && <span className={shared.hint}>{hint}</span>}
      </div>
      {error && <p className={shared.warn}>{error}</p>}
    </section>
  );
}
