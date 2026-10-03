"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum, foundry } from "wagmi/chains";
import { injected } from "wagmi";

const config = createConfig({
  chains: [foundry, arbitrum],
  connectors: [injected()],
  transports: { [foundry.id]: http(), [arbitrum.id]: http() },
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
