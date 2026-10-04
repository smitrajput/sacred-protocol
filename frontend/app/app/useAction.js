"use client";

import { useState } from "react";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

// Send one or more transactions in order, wait for each, and surface any error in plain words.
export default function useAction() {
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
