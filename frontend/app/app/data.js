"use client";

import { useQuery } from "@tanstack/react-query";
import { maxUint256 } from "viem";
import { useBlock, useReadContracts } from "wagmi";
import { fetchApi } from "../../lib/api";
import { coinSymbol, desk, fund, oracle, preview, reserve, sale, scr, usdc, vault } from "../../lib/contracts";
import { DESK_DEFAULTS, MAX_LEVERAGE_BPS } from "../../lib/defaults";

// Every read the app makes, by name. Each hook returns a plain object whose fields are undefined
// until the chain answers, and stay undefined for a call that reverts (a value from a stale feed,
// say). In preview the hooks hand back the sample figures and never touch the chain. Points are
// the one thing read from the server; everything else comes from the contracts, so the app works
// with the server switched off.

const REFRESH = { refetchInterval: 8_000 };
export const LIVE = 1;

export const call = (contract, functionName, ...args) => ({ ...contract, functionName, args });

// One multicall, answered by name.
function useReads(spec, { enabled = true, sample } = {}) {
  const names = Object.keys(spec);
  const { data } = useReadContracts({
    contracts: names.map((name) => spec[name]),
    query: { enabled: !preview && enabled, ...REFRESH },
  });
  if (preview) return sample ?? {};
  return Object.fromEntries(names.map((name, i) => [name, data?.[i]?.result]));
}

// The chain's clock, for anything timed on-chain such as a cooldown. In preview, the render time.
export function useChainTime(fallback) {
  const { data: block } = useBlock({ query: { enabled: !preview, ...REFRESH } });
  return block?.timestamp ?? BigInt(fallback);
}

// ───────────────────────── The bucket and its depositors ─────────────────────────

export function useBucket(sample) {
  return useReads(
    {
      idle: call(vault, "idle"),
      lent: call(vault, "lent"),
      reserve: call(vault, "reserve"),
      lastPrice: call(vault, "lastPrice"),
      nextCutoff: call(vault, "nextCutoff"),
    },
    { sample: sample?.bucket },
  );
}

export function useDepositor(address, sample) {
  const r = useReads(
    {
      shares: call(vault, "balanceOf", address),
      deposit: call(vault, "depositOf", address),
      withdraw: call(vault, "withdrawOf", address),
    },
    { enabled: !!address, sample: sample?.depositor },
  );
  if (preview) return r;
  return { shares: r.shares, queuedDeposit: r.deposit?.[0], queuedWithdraw: r.withdraw?.[0] };
}

// ───────────────────────── The desk and its tickets ─────────────────────────

export function useDeskParams() {
  return useReads(
    {
      baseRateBps: call(desk, "baseRateBps"),
      surchargeBps: call(desk, "surchargeBps"),
      surchargeAboveBps: call(desk, "surchargeAboveBps"),
      maxLeverageBps: call(desk, "maxLeverageBps"),
      minDownPayment: call(desk, "minDownPayment"),
    },
    { sample: { ...DESK_DEFAULTS, maxLeverageBps: MAX_LEVERAGE_BPS[coinSymbol] } },
  );
}

// The coin the feed says `cost` buys. The trader's price limit is a little below it.
export function useFairQuantity(cost) {
  const { quantity } = useReads({ quantity: call(oracle, "quantity", cost ?? 0n) }, { enabled: !!cost });
  return quantity;
}

// Every ticket on the desk that belongs to `address`, with today's settlement amount and the
// coin's value for the live ones, and any settlement surplus waiting to be collected.
export function useTickets(address, sample) {
  const onChain = !preview && !!address;
  const { nextId } = useReads({ nextId: call(desk, "nextId") }, { enabled: onChain });
  const ids = onChain && nextId ? Array.from({ length: Number(nextId - 1n) }, (_, i) => BigInt(i + 1)) : [];
  const { data: raw } = useReadContracts({
    contracts: ids.map((id) => call(desk, "getTicket", id)),
    query: { enabled: ids.length > 0, ...REFRESH },
  });
  const mine = preview
    ? sample.tickets
    : ids.map((id, i) => ({ id, ...(raw?.[i]?.result || {}) })).filter((t) => t.owner?.toLowerCase() === address.toLowerCase());
  const live = mine.filter((t) => t.status === LIVE);
  const { data: details } = useReadContracts({
    contracts: live.flatMap((t) => [call(desk, "settlementAmount", t.id), call(oracle, "value", t.qty)]),
    query: { enabled: onChain && live.length > 0, ...REFRESH },
  });
  const { owed } = useReads({ owed: call(desk, "owed", address) }, { enabled: onChain, sample: { owed: 0n } });

  const tickets = preview
    ? mine
    : mine.map((t) => {
        const k = live.indexOf(t);
        return k < 0 ? t : { ...t, settle: details?.[2 * k]?.result, value: details?.[2 * k + 1]?.result };
      });
  return { tickets, owed };
}

// ───────────────────────── The backstop fund and its stakers ─────────────────────────

export function useFund(sample) {
  return useReads(
    {
      totalStaked: call(fund, "totalStaked"),
      totalShares: call(fund, "totalShares"),
      available: call(fund, "available"),
      periodFinish: call(fund, "periodFinish"),
    },
    { sample: sample?.fund },
  );
}

export function useStaker(address, sample) {
  const r = useReads(
    {
      stake: call(fund, "stakeOf", address),
      shares: call(fund, "sharesOf", address),
      earned: call(fund, "earned", address),
      request: call(fund, "requestOf", address),
    },
    { enabled: !!address, sample: sample?.staker },
  );
  if (preview) return r;
  return { ...r, request: r.request && { shares: r.request[0], readyAt: r.request[1] } };
}

// ───────────────────────── The reserve sale ─────────────────────────

export function useSale(sample) {
  return useReads(
    {
      open: call(sale, "isOpen"),
      paused: call(sale, "paused"),
      price: call(sale, "price"),
      marketPrice: call(sale, "marketPrice"),
      reserveValue: call(sale, "reserveValuePerToken"),
      remaining: call(sale, "remainingThisPeriod"),
      reserveAssets: call(reserve, "totalAssets"),
      reserveTarget: call(reserve, "target"),
    },
    { sample: sample?.sale },
  );
}

// ───────────────────────── The wallet ─────────────────────────

// Balances and the approvals each panel needs before it can act.
export function useWallet(address) {
  return useReads(
    {
      usdc: call(usdc, "balanceOf", address),
      scr: call(scr, "balanceOf", address),
      usdcForVault: call(usdc, "allowance", address, vault.address),
      usdcForDesk: call(usdc, "allowance", address, desk.address),
      usdcForSale: call(usdc, "allowance", address, sale.address),
      scrForFund: call(scr, "allowance", address, fund.address),
    },
    { enabled: !!address, sample: {} },
  );
}

// ───────────────────────── The server ─────────────────────────

// Points for the connected wallet, or null while the server is unreachable.
export function usePoints(address) {
  const { data } = useQuery({
    queryKey: ["points", address],
    queryFn: () => fetchApi(`/points/${address}`),
    enabled: !preview && !!address,
    refetchInterval: 15_000,
    retry: false,
  });
  return data ?? null;
}

// ───────────────────────── Writing ─────────────────────────

export const approve = (token, spender) => call(token, "approve", spender.address, maxUint256);

// The calls to send before an action: an approval, unless the allowance already covers `needed`.
export const unlessAllowed = (allowance, needed, approval) =>
  allowance !== undefined && allowance >= needed ? [] : [approval];
