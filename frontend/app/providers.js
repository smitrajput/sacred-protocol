"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum, foundry } from "wagmi/chains";
import { injected } from "wagmi";
import { rpcUrl } from "../lib/contracts";

// The local chain's RPC comes from the environment so a test harness can point the app at its own
// node. anvil does not ship Multicall3, which wagmi would otherwise batch every read through, so
// the local chain declares no contracts and reads go one call at a time. Receipts are polled every
// two seconds: instant on anvil, cheap on Arbitrum. Arbitrum reads go to Alchemy through the
// site's own /api/rpc route, which holds the key; the URL is absolute because viem needs one.
const local = { ...foundry, contracts: {} };
const arbitrumRpc = typeof window === "undefined" ? undefined : `${window.location.origin}/api/rpc/${arbitrum.id}`;
const config = createConfig({
  chains: [local, arbitrum],
  connectors: [injected()],
  transports: { [local.id]: http(rpcUrl), [arbitrum.id]: http(arbitrumRpc, { batch: true }) },
  pollingInterval: 2_000,
  ssr: true,
});
const queryClient = new QueryClient();

export default function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
