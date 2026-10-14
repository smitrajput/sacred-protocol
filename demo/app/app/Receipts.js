"use client";

import { dismiss, useReceipts } from "../../lib/store.js";
import demo from "./demo.module.css";

// Confirmations, bottom centre: one line per transaction the chain accepted, the latest two,
// gone after a few seconds. The keeper's work (cut-offs, settlements) is labelled as such.
export default function Receipts() {
  const receipts = useReceipts();
  return (
    <div className={demo.receipts} aria-live="polite">
      {receipts.map((r) => (
        <button key={r.id} className={demo.receipt} onClick={() => dismiss(r.id)}>
          <span className={demo.receiptKind}>{r.kind === "keeper" ? "Keeper" : "Confirmed"}</span>
          {r.text}
        </button>
      ))}
    </div>
  );
}
