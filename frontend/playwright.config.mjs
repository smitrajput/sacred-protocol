import { defineConfig } from "@playwright/test";
import { PORTS } from "./e2e/harness.mjs";

// The flows run against one anvil chain, in order (depositor, trader, staker, buyer), each
// building on the state the one before left. One worker, no retries: a retry would replay
// transactions on a chain that has already moved on.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.mjs",
  globalTeardown: "./e2e/global-teardown.mjs",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 150_000,
  expect: { timeout: 25_000 },
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORTS.web}`,
    trace: "retain-on-failure",
  },
});
