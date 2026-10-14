import { alchemyUrl } from "../../../../lib/alchemy";

// The app's JSON-RPC endpoint for Arbitrum One (42161) and Monad testnet (10143), forwarded to
// Alchemy so the key stays on the server. Reads only: transactions are signed and sent by the
// user's own wallet, never through here. A request may be a single call or a batch of up to 50.

export const runtime = "nodejs";

const READS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "net_version",
]);
const MAX_BATCH = 50;
const MAX_BYTES = 64 * 1024;

const refuse = (status, message) =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message } }, { status });

export async function POST(request, { params }) {
  const { chain } = await params;
  const upstream = alchemyUrl(Number(chain));
  if (!upstream) return refuse(404, "Unknown chain");

  const text = await request.text();
  if (text.length > MAX_BYTES) return refuse(413, "Request too large");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return refuse(400, "Not JSON");
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > MAX_BATCH) return refuse(400, `Send 1 to ${MAX_BATCH} calls`);
  const blocked = calls.find((c) => !READS.has(c?.method));
  if (blocked) return refuse(403, `Method not allowed: ${String(blocked?.method)}`);

  const res = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json" }, body: text });
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
}
