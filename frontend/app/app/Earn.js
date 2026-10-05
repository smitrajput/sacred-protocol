"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { coinSymbol, preview, usdc, vault } from "../../lib/contracts";
import { formatUsdc, parseUsdc } from "../../lib/math";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import { approve, call, unlessAllowed, useBucket, useDepositor, useWallet } from "./data";
import { formatMoment } from "./format";
import Stat from "./Stat";
import useAction from "./useAction";

export default function Earn({ address, sample }) {
  const { run, busy, error } = useAction();
  const [amount, setAmount] = useState("");
  const [shares, setShares] = useState("");
  const bucket = useBucket(sample);
  const me = useDepositor(address, sample);
  const wallet = useWallet(address);

  const total = (bucket.idle ?? 0n) + (bucket.lent ?? 0n);
  const assets = parseUsdc(amount);
  const sharesIn = parseUsdc(shares);
  const canAct = !preview && !!address && !busy;
  const hint = preview
    ? "Deposits switch on once the contracts are deployed."
    : !address
      ? "Connect a wallet to deposit or withdraw."
      : null;

  return (
    <section className={shared.paper}>
      <div className={shared.head}>
        <h2 className={shared.title}>Earn</h2>
        <span className={shared.sub}>{coinSymbol} bucket</span>
      </div>

      <dl className={styles.stats}>
        <Stat label="In the bucket">{formatUsdc(total)} USDC</Stat>
        <Stat label="Financed">{total ? Number((bucket.lent * 10_000n) / total) / 100 : 0}%</Stat>
        <Stat label="Loss reserve">{formatUsdc(bucket.reserve ?? 0n)} USDC</Stat>
        <Stat label="Share price">{bucket.lastPrice ? Number(formatUnits(bucket.lastPrice, 18)).toFixed(6) : "1.000000"}</Stat>
        <Stat label="Next cut-off">{bucket.nextCutoff ? formatMoment(bucket.nextCutoff) : "..."}</Stat>
        <Stat label="Your shares">{formatUsdc(me.shares ?? 0n)}</Stat>
      </dl>

      <p className={`${shared.note} ${styles.spaced}`}>
        Deposits and withdrawals are processed once a week at the cut-off. Nothing is promised: yield comes from
        the markup traders pay, and losses fall on the bucket.
      </p>

      <div className={styles.form}>
        <div className={styles.pair}>
          <label className={shared.field}>
            <span className={shared.label}>Deposit, USDC</span>
            <input className={shared.input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div>
            <button
              className={shared.inkBtn}
              disabled={!canAct || !assets}
              onClick={() =>
                run(...unlessAllowed(wallet.usdcForVault, assets, approve(usdc, vault)), call(vault, "requestDeposit", assets))
              }
            >
              Request deposit
            </button>
          </div>
        </div>
        <div className={styles.pair}>
          <label className={shared.field}>
            <span className={shared.label}>Withdraw, shares</span>
            <input className={shared.input} inputMode="decimal" value={shares} onChange={(e) => setShares(e.target.value)} />
          </label>
          <div>
            <button
              className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
              disabled={!canAct || !sharesIn}
              onClick={() => run(call(vault, "requestWithdraw", sharesIn))}
            >
              Request withdrawal
            </button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <span className={shared.hint}>
          Queued deposit: {formatUsdc(me.queuedDeposit ?? 0n)} USDC. Queued withdrawal: {formatUsdc(me.queuedWithdraw ?? 0n)} shares.
        </span>
        <button
          className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
          disabled={!canAct}
          onClick={() => run(call(vault, "claimDeposit", address))}
        >
          Claim shares
        </button>
        <button
          className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
          disabled={!canAct}
          onClick={() => run(call(vault, "claimWithdraw", address))}
        >
          Claim USDC
        </button>
      </div>
      {hint && <p className={`${shared.hint} ${styles.spaced}`}>{hint}</p>}
      {error && <p className={shared.warn}>{error}</p>}
    </section>
  );
}
