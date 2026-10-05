// A wallet for the browser under test: an EIP-1193 provider on window.ethereum that answers the
// account and chain questions itself and forwards everything else to anvil, which signs for its
// own unlocked accounts. The app's real injected-wallet path is exercised; only the signing is
// stubbed, and nothing in the app knows the difference.
export const walletScript = ({ rpcUrl, account, chainId = 31337 }) => `
(() => {
  const account = ${JSON.stringify(account)};
  const chainHex = ${JSON.stringify(`0x${chainId.toString(16)}`)};
  const listeners = {};
  let id = 0;
  const rpc = async (method, params) => {
    const res = await fetch(${JSON.stringify(rpcUrl)}, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const { result, error } = await res.json();
    if (error) {
      const e = new Error(error.message);
      e.code = error.code;
      e.data = error.data;
      throw e;
    }
    return result;
  };
  const log = (method, params, outcome) =>
    console.debug("[wallet] " + method + " " + String(JSON.stringify(params ?? [])).slice(0, 300) + " -> " + outcome);
  window.ethereum = {
    isSacredTestWallet: true,
    request: async (args) => {
      try {
        const result = await handle(args);
        log(args.method, args.params, String(JSON.stringify(result)).slice(0, 120));
        return result;
      } catch (e) {
        log(args.method, args.params, "error " + e.message);
        throw e;
      }
    },
    on: (event, fn) => {
      (listeners[event] ||= []).push(fn);
    },
    removeListener: (event, fn) => {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
    },
  };
  async function handle({ method, params = [] }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account];
        case "eth_chainId":
          return chainHex;
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "wallet_requestPermissions":
        case "wallet_getPermissions":
          return [{ parentCapability: "eth_accounts" }];
        case "eth_sendTransaction": {
          // Like a real wallet: estimate the gas and add headroom, since an estimate made on
          // one state can fall short when the transaction is mined on the next.
          const tx = { ...params[0], from: account };
          if (!tx.gas) {
            const estimate = BigInt(await rpc("eth_estimateGas", [tx]));
            tx.gas = "0x" + ((estimate * 3n) / 2n).toString(16);
          }
          return rpc(method, [tx]);
        }
        default:
          return rpc(method, params);
      }
  }
})();
`;
