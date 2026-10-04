"use client";

import { useState } from "react";
import { formatUnits, maxUint256 } from "viem";
import { useAccount, useConnect, useDisconnect, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useConfig } from "wagmi";
import { STATUS, coinDecimals, coinSymbol, desk, oracle, usdc, vault } from "../lib/contracts";
import { exitPreview, formatUsdc, parseUsdc, quote } from "../lib/math";

const REFRESH = { query: { refetchInterval: 8_000 } };

// Send a transaction, wait for it, and surface any error in plain words.
function useAction() {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(...calls) {
    setBusy(true);
    setError("");
    try {
      for (const call of calls) {
        const hash = await writeContractAsync(call);
        await waitForTransactionReceipt(config, { hash });
      }
    } catch (e) {
      setError(e.shortMessage || e.message);
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error };
}

function Stat({ label, children }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{children}</b>
    </div>
  );
}

function Earn({ address }) {
  const { run, busy, error } = useAction();
  const [amount, setAmount] = useState("");
  const [shares, setShares] = useState("");
  const { data } = useReadContracts({
    contracts: [
      { ...vault, functionName: "idle" },
      { ...vault, functionName: "lent" },
      { ...vault, functionName: "reserve" },
      { ...vault, functionName: "lastPrice" },
      { ...vault, functionName: "nextCutoff" },
      { ...vault, functionName: "balanceOf", args: [address] },
      { ...vault, functionName: "depositOf", args: [address] },
      { ...vault, functionName: "withdrawOf", args: [address] },
      { ...usdc, functionName: "allowance", args: [address, vault.address] },
    ],
    ...REFRESH,
  });
  const [idle, lent, reserve, price, nextCutoff, myShares, myDeposit, myWithdraw, allowance] = (data || []).map((d) => d.result);
  const assets = parseUsdc(amount);
  const sharesIn = parseUsdc(shares);
  const total = (idle ?? 0n) + (lent ?? 0n);
  const approve = { ...usdc, functionName: "approve", args: [vault.address, maxUint256] };

  return (
    <section>
      <h2>Earn</h2>
      <div className="grid">
        <Stat label="In the bucket">{formatUsdc(total)} USDC</Stat>
        <Stat label="Financed">{total ? Number((lent * 10_000n) / total) / 100 : 0}%</Stat>
        <Stat label="Loss reserve">{formatUsdc(reserve ?? 0n)} USDC</Stat>
        <Stat label="Share price">{price ? Number(formatUnits(price, 18)).toFixed(6) : "1.000000"}</Stat>
        <Stat label="Next cut-off">{nextCutoff ? new Date(Number(nextCutoff) * 1000).toLocaleString() : "..."}</Stat>
        <Stat label="Your shares">{formatUsdc(myShares ?? 0n)}</Stat>
      </div>
      <p className="note">
        Deposits and withdrawals are processed once a week at the cut-off. Nothing is promised: yield comes from the markup traders pay,
        and losses fall on the bucket.
      </p>
      <div className="row">
        <input id="deposit-amount" placeholder="USDC to deposit" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button
          disabled={busy || !assets}
          onClick={() =>
            run(...(allowance >= assets ? [] : [approve]), { ...vault, functionName: "requestDeposit", args: [assets] })
          }
        >
          Request deposit
        </button>
        <input id="withdraw-shares" placeholder="Shares to withdraw" value={shares} onChange={(e) => setShares(e.target.value)} />
        <button className="ghost" disabled={busy || !sharesIn} onClick={() => run({ ...vault, functionName: "requestWithdraw", args: [sharesIn] })}>
          Request withdrawal
        </button>
      </div>
      <div className="row">
        <span className="note">
          Queued deposit: {formatUsdc(myDeposit?.[0] ?? 0n)} USDC. Queued withdrawal: {formatUsdc(myWithdraw?.[0] ?? 0n)} shares.
        </span>
        <button className="ghost" disabled={busy} onClick={() => run({ ...vault, functionName: "claimDeposit", args: [address] })}>
          Claim shares
        </button>
        <button className="ghost" disabled={busy} onClick={() => run({ ...vault, functionName: "claimWithdraw", args: [address] })}>
          Claim USDC
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function OrderForm({ address }) {
  const { run, busy, error } = useAction();
  const [down, setDown] = useState("1000");
  const [leverage, setLeverage] = useState("3");
  const [termDays, setTermDays] = useState(14);
  const { data } = useReadContracts({
    contracts: [
      { ...desk, functionName: "baseRateBps" },
      { ...desk, functionName: "surchargeBps" },
      { ...desk, functionName: "surchargeAboveBps" },
      { ...desk, functionName: "maxLeverageBps" },
      { ...usdc, functionName: "allowance", args: [address, desk.address] },
    ],
    ...REFRESH,
  });
  const [baseRateBps, surchargeBps, surchargeAboveBps, maxLeverageBps, allowance] = (data || []).map((d) => d.result);
  const downPayment = parseUsdc(down);
  const leverageBps = BigInt(Math.round(Number(leverage) * 10_000) || 0);
  const ready = downPayment && baseRateBps !== undefined && leverageBps > 10_000n && leverageBps <= (maxLeverageBps ?? 0n);
  const q = ready ? quote({ downPayment, leverageBps, termDays, baseRateBps, surchargeBps, surchargeAboveBps }) : null;
  // The trader's price limit: accept at most 0.3% less coin than the feed price implies.
  const { data: fairQty } = useReadContract({ ...oracle, functionName: "quantity", args: [q?.cost ?? 0n], query: { enabled: !!q } });
  const minCoinOut = fairQty ? (fairQty * 9_970n) / 10_000n : 0n;
  const approve = { ...usdc, functionName: "approve", args: [desk.address, maxUint256] };

  return (
    <section>
      <h2>Buy {coinSymbol} now, pay the rest later</h2>
      <div className="row">
        <input id="down-payment" value={down} onChange={(e) => setDown(e.target.value)} placeholder="Down payment, USDC" />
        <input id="leverage" value={leverage} onChange={(e) => setLeverage(e.target.value)} placeholder="Leverage" style={{ width: 90 }} />
        <select id="term" value={termDays} onChange={(e) => setTermDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
        </select>
        <button
          disabled={busy || !q}
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
      </div>
      {q && (
        <div className="grid">
          <Stat label={`${coinSymbol} bought for`}>{formatUsdc(q.cost)} USDC</Stat>
          <Stat label="One fixed cost (markup)">{formatUsdc(q.markup)} USDC</Stat>
          <Stat label={`You owe in ${termDays} days`}>{formatUsdc(q.balance)} USDC</Stat>
          <Stat label="Yearly rate">{Number(q.rateBps) / 100}%</Stat>
        </div>
      )}
      <p className="note">
        The markup is the only charge and it never grows. Leave early and you pay only for the days used. If your ticket ends in profit
        you keep 70% and 30% goes to the backstop fund. Price drops do not close your position before the due date.
      </p>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Tickets({ address }) {
  const { run, busy, error } = useAction();
  const [part, setPart] = useState({});
  const { data: nextId } = useReadContract({ ...desk, functionName: "nextId", ...REFRESH });
  const ids = Array.from({ length: Number((nextId ?? 1n) - 1n) }, (_, i) => BigInt(i + 1));
  const { data: raw } = useReadContracts({ contracts: ids.map((id) => ({ ...desk, functionName: "getTicket", args: [id] })), ...REFRESH });
  const mine = ids
    .map((id, i) => ({ id, ...(raw?.[i]?.result || {}) }))
    .filter((t) => t.owner && t.owner.toLowerCase() === address.toLowerCase());
  const live = mine.filter((t) => t.status === 1);
  const { data: details } = useReadContracts({
    contracts: live.flatMap((t) => [
      { ...desk, functionName: "settlementAmount", args: [t.id] },
      { ...oracle, functionName: "value", args: [t.qty] },
    ]),
    ...REFRESH,
  });
  const { data: owed } = useReadContract({ ...desk, functionName: "owed", args: [address], ...REFRESH });
  const { data: allowance } = useReadContract({ ...usdc, functionName: "allowance", args: [address, desk.address], ...REFRESH });
  const approve = { ...usdc, functionName: "approve", args: [desk.address, maxUint256] };
  const withApproval = (needed, call) => run(...(allowance >= needed ? [] : [approve]), call);

  return (
    <section>
      <h2>Your tickets</h2>
      {mine.length === 0 && <p className="note">No tickets yet.</p>}
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>#</th><th>{coinSymbol}</th><th>Status</th><th>Due</th><th>To settle today</th><th>Worth now</th><th>You would get</th><th></th>
            </tr>
          </thead>
          <tbody>
            {mine.map((t) => {
              const k = live.findIndex((l) => l.id === t.id);
              const s = k >= 0 ? details?.[2 * k]?.result : undefined;
              const value = k >= 0 ? details?.[2 * k + 1]?.result : undefined;
              const p = s !== undefined && value !== undefined ? exitPreview({ coinValue: value, settlementAmount: s, paidIn: t.downPayment + t.repaid }) : null;
              const partAmount = parseUsdc(part[t.id] || "");
              return (
                <tr key={t.id}>
                  <td>{String(t.id)}</td>
                  <td>{formatUnits(t.qty ?? 0n, coinDecimals)}</td>
                  <td>{STATUS[t.status]}</td>
                  <td>{new Date(Number(t.due) * 1000).toLocaleDateString()}</td>
                  <td>{s !== undefined ? formatUsdc(s) : ""}</td>
                  <td>{value !== undefined ? formatUsdc(value) : ""}</td>
                  <td>{p ? (p.canClose ? formatUsdc(p.toTrader) : "under water") : ""}</td>
                  <td>
                    {t.status === 1 && (
                      <div className="row">
                        <button
                          disabled={busy || !p?.canClose}
                          onClick={() => run({ ...desk, functionName: "close", args: [t.id, (value * 9_970n) / 10_000n] })}
                        >
                          Close
                        </button>
                        <button className="ghost" disabled={busy || s === undefined} onClick={() => withApproval(s + (p?.toFund ?? 0n), { ...desk, functionName: "payOff", args: [t.id] })}>
                          Pay off
                        </button>
                        <input
                          id={`part-${t.id}`}
                          style={{ width: 90 }}
                          placeholder="USDC"
                          value={part[t.id] || ""}
                          onChange={(e) => setPart({ ...part, [t.id]: e.target.value })}
                        />
                        <button className="ghost" disabled={busy || !partAmount} onClick={() => withApproval(partAmount, { ...desk, functionName: "partPay", args: [t.id, partAmount] })}>
                          Part pay
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {owed > 0n && (
        <div className="row">
          <span>{formatUsdc(owed)} USDC is waiting for you from settled tickets.</span>
          <button disabled={busy} onClick={() => run({ ...desk, functionName: "claimOwed" })}>Collect</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

export default function Page() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <main>
      <header>
        <h1>Destiny</h1>
        {isConnected ? (
          <button className="ghost" onClick={() => disconnect()}>{address.slice(0, 6)}...{address.slice(-4)}</button>
        ) : (
          <button onClick={() => connect({ connector: connectors[0] })}>Connect wallet</button>
        )}
      </header>
      {isConnected ? (
        <>
          <OrderForm address={address} />
          <Tickets address={address} />
          <Earn address={address} />
        </>
      ) : (
        <section>
          <p>Halal leverage for traders. Real yield for depositors. No interest anywhere.</p>
          <p className="note">Connect a wallet to open a ticket or deposit. Not certified by a Shariah board yet.</p>
        </section>
      )}
    </main>
  );
}
