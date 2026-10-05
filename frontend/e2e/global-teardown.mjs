import fs from "node:fs";
import path from "node:path";
import { ROOT, RUN_FILE, readRun, stop } from "./harness.mjs";

export default async function globalTeardown() {
  if (!fs.existsSync(RUN_FILE)) return;
  await Promise.all(Object.values(readRun().pids).map(stop));
  fs.rmSync(RUN_FILE, { force: true });
  fs.rmSync(path.join(ROOT, "deployments", "e2e.json"), { force: true });
}
