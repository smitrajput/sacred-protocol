import { createPublicClient, http } from "viem";
import { arbitrum, monadTestnet } from "viem/chains";

// Alchemy is the node behind every chain read the site makes on Arbitrum One and Monad testnet.
// The key is a server-side variable (ALCHEMY_API_KEY, not NEXT_PUBLIC_), so Next never puts it in
// a browser bundle: the app reaches Alchemy through /api/rpc/<chain id>, and the docs read on the
// server. Import this file from server code only.

const NETWORKS = {
  [arbitrum.id]: { chain: arbitrum, host: "arb-mainnet" },
  [monadTestnet.id]: { chain: monadTestnet, host: "monad-testnet" },
};

export function alchemyUrl(chainId) {
  const net = NETWORKS[chainId];
  const key = process.env.ALCHEMY_API_KEY;
  return net && key ? `https://${net.host}.g.alchemy.com/v2/${key}` : null;
}

export function alchemyClient(chainId) {
  const url = alchemyUrl(chainId);
  return url ? createPublicClient({ chain: NETWORKS[chainId].chain, transport: http(url, { batch: true }) }) : null;
}
