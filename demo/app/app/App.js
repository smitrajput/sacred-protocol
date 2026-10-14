"use client";

import { useEffect, useState } from "react";
import { assetSymbol } from "../../lib/contracts";
import { formatAmount, formatUsdc } from "../../lib/math";
import { ME } from "../../lib/sim.js";
import { useChain } from "../../lib/store.js";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import demo from "./demo.module.css";
import Earn from "./Earn";
import OrderForm from "./OrderForm";
import Positions from "./Positions";
import Presenter from "./Presenter";
import Receipts from "./Receipts";
import { useWallet } from "./data";
import { formatDay } from "./format";

// The app as it ships, for the two roles in the demo: the trader's panels on the left (the order
// form and their positions) and the depositor's on the right. The chain is simulated in the
// browser; the wallet is a demo wallet that connects without an extension. The bar adds what a
// viewer needs to follow the simulated chain: today's date on it and the wallet's balances.
export default function App() {
  const [address, setAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [presenterOpen, setPresenterOpen] = useState(false);
  const { now } = useChain();
  const wallet = useWallet(address);

  // The presenter's panel opens and closes with the backtick key, so it can stay off camera.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "`" && !(e.target instanceof HTMLInputElement)) setPresenterOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function connect() {
    setConnecting(true);
    setTimeout(() => {
      setAddress(ME);
      setConnecting(false);
    }, 700);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <span className={styles.brand}>Sacred</span>
        <span className={styles.bucket}>{assetSymbol} bucket, term mode</span>
        <div className={styles.barRight}>
          {showBadge && <span className={demo.badge}>Demo, simulated chain</span>}
          <span className={demo.chip}>{formatDay(now)}</span>
          {address && (
            <span className={demo.chip}>
              {formatUsdc(wallet.usdc ?? 0n)} USDC · {formatAmount(wallet.mon ?? 0n, 18, 2)} {assetSymbol}
            </span>
          )}
          {address ? (
            <button className={`${shared.btn} ${shared.btnGhost}`} onClick={() => setAddress(null)}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          ) : (
            <button className={`${shared.btn} ${shared.btnPrimary}`} disabled={connecting} onClick={connect}>
              {connecting ? "Connecting..." : "Connect wallet"}
            </button>
          )}
        </div>
      </header>

      <main className={styles.grid}>
        <div className={styles.stack}>
          <OrderForm address={address} />
          <Positions address={address} />
        </div>
        <div className={styles.stack}>
          <Earn address={address} />
        </div>
      </main>

      <Receipts />
      {presenterOpen && (
        <Presenter
          me={ME}
          showBadge={showBadge}
          onToggleBadge={() => setShowBadge((v) => !v)}
          onClose={() => setPresenterOpen(false)}
        />
      )}
    </div>
  );
}
