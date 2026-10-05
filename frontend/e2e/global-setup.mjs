// Before the flows: a fresh anvil, the whole system deployed on it, the keeper and the API
// running against it, and the app pointed at all three. Everything is recorded in
// e2e/.run.json for the tests and the teardown.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { KEEPER_KEY } from "./chain.mjs";
import { FOUNDRY, FRONTEND, LOGS, PORTS, PYTHON, ROOT, RUN_FILE, httpOk, portFree, rpcUp, start, stop, waitFor } from "./harness.mjs";

// Run the local deployment script against anvil. If it stalls, record what anvil and the
// process table look like before giving up, so a hang can be diagnosed from the logs.
function deploy(rpcUrl) {
  return new Promise((resolve, reject) => {
    const forge = spawn(path.join(FOUNDRY, "forge"), ["script", "script/DeployLocal.s.sol", "--rpc-url", rpcUrl, "--broadcast"], {
      cwd: path.join(ROOT, "contracts"),
      env: { ...process.env, DEPLOYMENT_OUT: "../deployments/e2e.json" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    forge.stdout.on("data", (d) => (output += d));
    forge.stderr.on("data", (d) => (output += d));
    const watchdog = setTimeout(async () => {
      const rpc = async (method, params = []) => {
        try {
          const res = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
          return JSON.stringify((await res.json()).result);
        } catch (e) {
          return `error ${e.message}`;
        }
      };
      const diag = [
        `block ${await rpc("eth_blockNumber")}`,
        `nonce ${await rpc("eth_getTransactionCount", ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "latest"])}`,
        `pool ${await rpc("txpool_status")}`,
        `automine ${await rpc("anvil_getAutomine")}`,
        `processes:\n${spawnSync("ps", ["-ef"], { encoding: "utf8" }).stdout.split("\n").filter((l) => /anvil|forge|next|uvicorn|destiny/.test(l)).join("\n")}`,
        `forge output so far:\n${output}`,
      ].join("\n");
      fs.writeFileSync(path.join(LOGS, "deploy-hang.txt"), diag);
      forge.kill("SIGKILL");
      reject(new Error(`deployment stalled; see e2e/.logs/deploy-hang.txt\n${diag}`));
    }, 60_000);
    forge.on("exit", (code) => {
      clearTimeout(watchdog);
      if (code === 0) resolve();
      else reject(new Error(`deployment failed (${code}):\n${output}`));
    });
  });
}

export default async function globalSetup() {
  const rpcUrl = `http://127.0.0.1:${PORTS.anvil}`;
  const apiUrl = `http://127.0.0.1:${PORTS.api}`;
  const baseURL = `http://127.0.0.1:${PORTS.web}`;
  const deployment = path.join(ROOT, "deployments", "e2e.json");
  const pids = {};
  fs.rmSync(LOGS, { recursive: true, force: true });

  try {
    // A previous run may still be shutting down; its anvil would answer in place of ours.
    for (const port of Object.values(PORTS)) {
      await waitFor(() => portFree(port), { timeoutMs: 20_000, label: `port ${port} to be free` });
    }
    pids.anvil = start("anvil", "anvil", ["--port", String(PORTS.anvil), "--silent"]);
    await waitFor(() => rpcUp(rpcUrl), { label: "anvil" });

    await deploy(rpcUrl);
    const addresses = JSON.parse(fs.readFileSync(deployment, "utf8"));

    const serverEnv = {
      PYTHONUNBUFFERED: "1",
      RPC_URL: rpcUrl,
      DEPLOYMENT: deployment,
      DB_PATH: path.join(LOGS, "e2e.sqlite"),
      KEEPER_KEY,
      POLL_SECONDS: "1",
    };
    const server = path.join(ROOT, "server");
    pids.api = start("api", PYTHON, ["-m", "uvicorn", "--factory", "destiny.api:app_from_env", "--port", String(PORTS.api)], {
      cwd: server,
      env: serverEnv,
    });
    pids.keeper = start("keeper", PYTHON, ["-m", "destiny.keeper"], { cwd: server, env: serverEnv });

    pids.web = start("web", path.join(FRONTEND, "node_modules", ".bin", "next"), ["dev", "-p", String(PORTS.web)], {
      cwd: FRONTEND,
      env: {
        NEXT_PUBLIC_RPC_URL: rpcUrl,
        NEXT_PUBLIC_API_URL: apiUrl,
        NEXT_PUBLIC_VAULT: addresses.vault,
        NEXT_PUBLIC_DESK: addresses.desk,
        NEXT_PUBLIC_USDC: addresses.usdc,
        NEXT_PUBLIC_ORACLE: addresses.oracle,
        NEXT_PUBLIC_SCR: addresses.token,
        NEXT_PUBLIC_FUND: addresses.fund,
        NEXT_PUBLIC_SALE: addresses.sale,
        NEXT_PUBLIC_RESERVE: addresses.reserve,
        NEXT_PUBLIC_COIN_SYMBOL: "BTC",
        NEXT_PUBLIC_COIN_DECIMALS: "8",
      },
    });

    await waitFor(() => httpOk(`${apiUrl}/health`), { label: "the API" });
    await waitFor(() => httpOk(`${baseURL}/app`), { timeoutMs: 180_000, label: "next dev" });
    fs.writeFileSync(RUN_FILE, JSON.stringify({ rpcUrl, apiUrl, baseURL, addresses, pids }, null, 2));
  } catch (error) {
    await Promise.all(Object.values(pids).map(stop));
    throw error;
  }
}
