"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useConfig, useWriteContract } from "wagmi";
import { simulateContract, waitForTransactionReceipt } from "wagmi/actions";
import { explain } from "../../lib/errors";

// Send one or more transactions in order: simulate each (so a refusal is decoded into plain
// words and no failing transaction is sent), send it, wait for it, then refresh every figure on
// the page.
export default function useAction() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(...calls) {
    setBusy(true);
    setError("");
    try {
      for (const call of calls) {
        await simulateContract(config, call);
        const hash = await writeContractAsync(call);
        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error(`The transaction reverted (${hash.slice(0, 10)}).`);
      }
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error };
}
