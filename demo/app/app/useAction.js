"use client";

import { useState } from "react";
import { addReceipt, send } from "../../lib/store.js";

// The demo's stand-in for the app's useAction: the same `run(...calls)`, with each call sent to
// the simulated chain after a pause the length of a wallet confirmation and a block.
const CONFIRM_MS = 1_100;

export default function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(...calls) {
    setBusy(true);
    setError("");
    try {
      for (const call of calls) {
        await new Promise((r) => setTimeout(r, CONFIRM_MS));
        addReceipt(send(call));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error };
}
