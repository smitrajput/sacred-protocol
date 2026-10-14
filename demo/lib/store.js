"use client";

import { useSyncExternalStore } from "react";
import { advance, execute, initialState, isRefusal, runCutoff, setPrice, settleDue } from "./sim.js";

// The simulated chain's state for the page, and a short list of receipts the page shows as
// confirmations. Everything lives in memory: a reload starts the demo afresh.

let state = initialState();
let receipts = [];
let nextReceipt = 1;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

export const useChain = () => useSyncExternalStore(subscribe, () => state, () => state);
export const useReceipts = () => useSyncExternalStore(subscribe, () => receipts, () => receipts);

export function addReceipt(text, kind = "ok") {
  const id = nextReceipt++;
  receipts = [...receipts, { id, text, kind }].slice(-2);
  emit();
  setTimeout(() => dismiss(id), 4_500);
}

export function dismiss(id) {
  receipts = receipts.filter((r) => r.id !== id);
  emit();
}

// Send one transaction from the demo wallet. Returns the receipt; throws a plain-words reason.
export function send(call) {
  try {
    const r = execute(state, call);
    state = r.state;
    emit();
    return r.receipt;
  } catch (e) {
    throw isRefusal(e) ? e : new Error(`Simulation error: ${e.message}`);
  }
}

// ───────────────────────── The presenter's controls ─────────────────────────

export const presenter = {
  setPrice(price) {
    state = setPrice(state, price);
    emit();
  },
  advance(seconds) {
    state = advance(state, seconds);
    emit();
  },
  cutoff() {
    const r = runCutoff(state);
    state = r.state;
    emit();
    addReceipt(r.receipt, "keeper");
  },
  settleDue(me) {
    const before = state;
    const r = settleDue(state);
    state = r.state;
    emit();
    const mine = Object.values(before.desk.positions).filter((t) => t.owner === me && r.state.desk.positions[t.id].status !== t.status);
    const others = r.receipts.length - mine.length;
    r.receipts
      .filter((text) => mine.some((t) => text.startsWith(`Position ${t.id} `)))
      .forEach((text) => addReceipt(text, "keeper"));
    if (others > 0) addReceipt(`Keeper settled ${others} other trader${others > 1 ? "s'" : "'s"} position${others > 1 ? "s" : ""}`, "keeper");
    if (r.receipts.length === 0) addReceipt("No position is past its due date yet", "keeper");
  },
  reset() {
    state = initialState();
    receipts = [];
    emit();
  },
};
