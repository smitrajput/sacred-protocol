"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { coinDecimals, coinSymbol, preview } from "../../lib/contracts";
import shared from "../shared/shared.module.css";
import styles from "./app.module.css";
import Earn from "./Earn";
import OrderForm from "./OrderForm";
import { sampleData } from "./sample";
import Tickets from "./Tickets";

// The app: a wallet bar, the order form and the trader's tickets on the left, the bucket on
// the right. In preview (no contract addresses configured) the panels show sample figures and
// every transaction button is off; quotes still use the real arithmetic.
export default function App({ spotPrice, renderedAt }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Sample figures are derived from the render time so server and client agree.
  const sample = useMemo(
    () => (preview ? sampleData({ spotPrice, coinDecimals, now: renderedAt }) : null),
    [spotPrice, renderedAt],
  );

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link href="/" className={styles.brand}>
          Sacred
        </Link>
        <span className={styles.bucket}>{coinSymbol} bucket, term mode</span>
        {isConnected ? (
          <button className={`${shared.btn} ${shared.btnGhost}`} onClick={() => disconnect()}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </button>
        ) : (
          <button
            className={`${shared.btn} ${shared.btnPrimary}`}
            disabled={connectors.length === 0}
            onClick={() => connect({ connector: connectors[0] })}
          >
            Connect wallet
          </button>
        )}
      </header>

      {preview && (
        <p className={styles.preview}>
          Preview. The contracts are not deployed yet, so the figures below are sample values and transactions
          are switched off. Quotes use the real arithmetic.
        </p>
      )}

      <main className={styles.grid}>
        <div className={styles.stack}>
          <OrderForm address={address} spotPrice={spotPrice} />
          <Tickets address={address} sample={sample} spotPrice={spotPrice} now={renderedAt} />
        </div>
        <Earn address={address} sample={sample} />
      </main>
    </div>
  );
}
