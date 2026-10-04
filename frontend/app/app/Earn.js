"use client";

import { useState } from "react";
import { formatUnits, maxUint256 } from "viem";
import { useReadContracts } from "wagmi";
import { coinSymbol, preview, usdc, vault } from "../../lib/contracts";
import { formatUsdc, parseUsdc } from "../../lib/math";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import { formatMoment } from "./format";
import useAction from "./useAction";

const REFRESH = { refetchInterval: 8_000 };

export default function Earn({ address, sample }) {
  const { run, busy, error } = useAction();
  const [amount, setAmount] = useState("");
  const [shares, setShares] = useState("");
  const onChain = !preview && !!address;

  // The bucket's figures, then the depositor's own. In preview, the sample bucket.
  const { data: bucket } = useReadContracts({
    contracts: [
      { ...vault, functionName: "idle" },
      { ...vault, functionName: "lent" },
      { ...vault, functionName: "reserve" },
      { ...vault, functionName: "lastPrice" },
      { ...vault, functionName: "nextCutoff" },
    ],
    query: { enabled: !preview, ...REFRESH },
  });
  const { data: own } = useReadContracts({
    contracts: [
      { ...vault, functionName: "balanceOf", args: [address] },
      { ...vault, functionName: "depositOf", args: [address] },
      { ...vault, functionName: "withdrawOf", args: [address] },
      { ...usdc, functionName: "allowance", args: [address, vault.address] },
    ],
    query: { enabled: onChain, ...REFRESH },
  });
  const [idle, lent, reserve, price, nextCutoff] = preview
    ? [sample.bucket.idle, sample.bucket.lent, sample.bucket.reserve, sample.bucket.lastPrice, sample.bucket.nextCutoff]
    : (bucket || []).map((d) => d.result);
  const [myShares, myDeposit, myWithdraw, allowance] = preview
    ? [sample.bucket.myShares, [sample.bucket.myDeposit], [sample.bucket.myWithdraw], 0n]
    : (own || []).map((d) => d.result);

  const total = (idle ?? 0n) + (lent ?? 0n);
  const assets = parseUsdc(amount);
  const sharesIn = parseUsdc(shares);
  const approve = { ...usdc, functionName: "approve", args: [vault.address, maxUint256] };
  const canAct = onChain && !busy;
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
        <Stat label="Financed">{total ? Number((lent * 10_000n) / total) / 100 : 0}%</Stat>
        <Stat label="Loss reserve">{formatUsdc(reserve ?? 0n)} USDC</Stat>
        <Stat label="Share price">{price ? Number(formatUnits(price, 18)).toFixed(6) : "1.000000"}</Stat>
        <Stat label="Next cut-off">{nextCutoff ? formatMoment(nextCutoff) : "..."}</Stat>
        <Stat label="Your shares">{formatUsdc(myShares ?? 0n)}</Stat>
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
              onClick={() => run(...(allowance >= assets ? [] : [approve]), { ...vault, functionName: "requestDeposit", args: [assets] })}
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
              onClick={() => run({ ...vault, functionName: "requestWithdraw", args: [sharesIn] })}
            >
              Request withdrawal
            </button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <span className={shared.hint}>
          Queued deposit: {formatUsdc(myDeposit?.[0] ?? 0n)} USDC. Queued withdrawal: {formatUsdc(myWithdraw?.[0] ?? 0n)} shares.
        </span>
        <button
          className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
          disabled={!canAct}
          onClick={() => run({ ...vault, functionName: "claimDeposit", args: [address] })}
        >
          Claim shares
        </button>
        <button
          className={`${shared.inkBtn} ${shared.inkBtnGhost}`}
          disabled={!canAct}
          onClick={() => run({ ...vault, functionName: "claimWithdraw", args: [address] })}
        >
          Claim USDC
        </button>
      </div>
      {hint && <p className={`${shared.hint} ${styles.spaced}`}>{hint}</p>}
      {error && <p className={shared.warn}>{error}</p>}
    </section>
  );
}

function Stat({ label, children }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
