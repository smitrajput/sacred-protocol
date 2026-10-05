// Starts and stops the processes the flows run against: anvil, the keeper, the API and Next.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = path.resolve(FRONTEND, "..");
export const LOGS = path.join(FRONTEND, "e2e", ".logs");
export const RUN_FILE = path.join(FRONTEND, "e2e", ".run.json");
export const FOUNDRY = path.join(process.env.HOME, ".foundry", "bin");
export const PYTHON = path.join(ROOT, "server", ".venv", "bin", "python");

// Away from the defaults, so a developer's own anvil, server and app keep running.
export const PORTS = { anvil: 8547, api: 8011, web: 3101 };

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Start a process in its own group, logging to e2e/.logs/<name>.log, so the whole group can be
// stopped later (next dev spawns children of its own).
export function start(name, command, args, { cwd, env = {} } = {}) {
  fs.mkdirSync(LOGS, { recursive: true });
  const out = fs.openSync(path.join(LOGS, `${name}.log`), "w");
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, PATH: `${FOUNDRY}:${process.env.PATH}`, ...env },
    stdio: ["ignore", out, out],
    detached: true,
  });
  child.unref();
  return child.pid;
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Stop a process group and wait until its leader has really gone, so the next run finds the
// ports free rather than a process that is still shutting down.
export async function stop(pid) {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return; // already gone
  }
  for (let i = 0; i < 40 && alive(pid); i++) await sleep(250);
  if (alive(pid)) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // gone in the meantime
    }
  }
}

// True once nothing accepts connections on the port.
export const portFree = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
  });

export async function waitFor(check, { timeoutMs = 60_000, label }) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (await check()) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${label}`);
}

export const httpOk = async (url) => (await fetch(url)).ok;

export const rpcUp = async (url) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  });
  return (await res.json()).result === "0x7a69";
};

export const readRun = () => JSON.parse(fs.readFileSync(RUN_FILE, "utf8"));
