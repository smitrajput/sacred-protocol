import { defineConfig } from "vitest/config";

// Unit tests live next to the code in lib/. The browser flows in e2e/ are Playwright's.
export default defineConfig({
  test: { include: ["lib/**/*.test.js"] },
});
