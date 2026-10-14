"use client";

import { maxUint256 } from "viem";
import { read } from "../../lib/sim.js";
import { useChain } from "../../lib/store.js";

// The demo's stand-in for the app's data.js: the same hooks, the same shapes, answered by the
// simulated chain instead of RPC calls.

export const LIVE = 1;

export const call = (contract, functionName, ...args) => ({ ...contract, functionName, args });

export const useChainTime = () => useChain().now;

export const useBucket = () => read.bucket(useChain());

export function useDepositor(address) {
  const s = useChain();
  return address ? read.depositor(s, address) : {};
}

export const useDeskParams = () => read.deskParams();

export const useFeedPrice = () => read.feedPrice(useChain());

export function useFairQuantity(cost) {
  const s = useChain();
  return cost ? read.fairQuantity(s, cost) : undefined;
}

export function usePositions(address) {
  const s = useChain();
  return address ? read.positions(s, address) : { positions: [], owed: 0n };
}

export function useWallet(address) {
  const s = useChain();
  return address ? read.wallet(s, address) : {};
}

export const usePoints = () => null;

export const approve = (token, spender) => call(token, "approve", spender.address, maxUint256);

export const unlessAllowed = (allowance, needed, approval) =>
  allowance !== undefined && allowance >= needed ? [] : [approval];
