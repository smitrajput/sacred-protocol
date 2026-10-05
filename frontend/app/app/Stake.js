"use client";

import { useState } from "react";
import { fund, preview, scr } from "../../lib/contracts";
import { formatUsdc, parseScr } from "../../lib/math";
import { formatScr, sharesFor, stakeBehind, unstakePhase } from "../../lib/scr";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import { approve, call, unlessAllowed, useChainTime, useFund, useStaker, useWallet } from "./data";
import { formatDay, formatMoment } from "./format";
import Stat from "./Stat";
import useAction from "./useAction";

// The staker's panel. SCR goes in and earns a stream of USDC from traders' profit share; it can
// be sold to cover a shortfall; leaving takes a cooldown and then a short window.
export default function Stake({ address, sample, now }) {
  const { run, busy, error } = useAction();
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const pool = useFund(sample);
  const me = useStaker(address, sample);
  const wallet = useWallet(address);
  const chainNow = useChainTime(now);

  const stakeIn = parseScr(amountIn);
  const stakeOut = parseScr(amountOut);
  // A request to leave is made in shares; the staker types SCR.
  const sharesOut =
    stakeOut && me.shares !== undefined && pool.totalShares !== undefined
      ? min(sharesFor(stakeOut, pool.totalShares, pool.totalStaked), me.shares)
      : null;
  const leaving = unstakePhase(me.request, chainNow);
  const leavingScr = leaving.shares ? formatScr(stakeBehind(leaving.shares, pool.totalShares ?? 0n, pool.totalStaked ?? 0n)) : "";
  const canAct = !preview && !!address && !busy;
  const hint = preview
    ? "Staking switches on once the contracts are deployed."
    : !address
      ? "Connect a wallet to stake."
      : null;

  return (
    <section className={shared.paper}>
      <div className={shared.head}>
        <h2 className={shared.title}>Stake SCR</h2>
        <span className={shared.sub}>Backstop fund</span>
      </div>

      <dl className={styles.stats}>
        <Stat label="Staked in the fund">{formatScr(pool.totalStaked)} SCR</Stat>
        <Stat label="USDC it can pay">{formatUsdc(pool.available ?? 0n)} USDC</Stat>
        <Stat label="Your stake">{formatScr(me.stake)} SCR</Stat>
        <Stat label="USDC earned">{formatUsdc(me.earned ?? 0n)}</Stat>
        <Stat label="Your SCR">{formatScr(wallet.scr)}</Stat>
      </dl>

      <p className={`${shared.note} ${styles.spaced}`}>
        Stakers stand behind shortfalls. After a bucket&apos;s loss reserve and the fund&apos;s USDC, staked SCR is
        sold, up to 30% at a time. In return, 65% of traders&apos; profit share streams to stakers in USDC over 90
        days. No emissions, no rebase. Nothing is promised.
      </p>

      <div className={styles.form}>
        <div className={styles.pair}>
          <label className={shared.field}>
            <span className={shared.label}>Stake, SCR</span>
            <input className={shared.input} inputMode="decimal" value={amountIn} onChange={(e) => setAmountIn(e.target.value)} />
          </label>
          <div>
            <button
              className={shared.inkBtn}
              disabled={!canAct || !stakeIn}
              onClick={() => run(...unlessAllowed(wallet.scrForFund, stakeIn, approve(scr, fund)), call(fund, "stake", stakeIn))}
            >
              Stake
            </button>
          </div>
        </div>
        <div className={styles.pair}>
          <label className={shared.field}>
            <span className={shared.label}>Unstake, SCR</span>
            <input className={shared.input} inputMode="decimal" value={amountOut} onChange={(e) => setAmountOut(e.target.value)} />
          </label>
          <div>
            <button
              className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
              disabled={!canAct || !sharesOut}
              onClick={() => run(call(fund, "requestUnstake", sharesOut))}
            >
              Request unstake
            </button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <span className={shared.hint}>
          {leaving.phase === "none" && "Leaving takes a 14 day cooldown, then a 7 day window to take your SCR out."}
          {leaving.phase === "cooling" && `${leavingScr} SCR cooling down until ${formatMoment(leaving.until)}.`}
          {leaving.phase === "open" && `${leavingScr} SCR ready to take out until ${formatMoment(leaving.until)}.`}
          {leaving.phase === "missed" && `The window for ${leavingScr} SCR closed on ${formatDay(leaving.since)}. Request again.`}
        </span>
        {leaving.phase === "open" && (
          <button className={shared.inkBtn} disabled={!canAct} onClick={() => run(call(fund, "unstake"))}>
            Take SCR out
          </button>
        )}
        <button
          className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
          disabled={!canAct || !(me.earned > 0n)}
          onClick={() => run(call(fund, "claim"))}
        >
          Claim USDC
        </button>
      </div>
      {hint && <p className={`${shared.hint} ${styles.spaced}`}>{hint}</p>}
      {error && <p className={shared.warn}>{error}</p>}
    </section>
  );
}

const min = (a, b) => (a < b ? a : b);
