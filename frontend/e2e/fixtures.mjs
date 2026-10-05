// Shared fixtures: the running system, a chain helper, and a page connected as one actor.
import { expect, test as base } from "@playwright/test";
import { makeChain } from "./chain.mjs";
import { readRun } from "./harness.mjs";
import { walletScript } from "./wallet.mjs";

export { expect };

export const test = base.extend({
  // What the page and the wallet logged, printed when a flow fails along with any error the
  // panels were showing. An auto fixture, so it applies in every spec file.
  log: [
    async ({ page }, use, info) => {
      const lines = [];
      page.on("console", (m) => lines.push(`${m.type()}: ${m.text()}`));
      page.on("pageerror", (e) => lines.push(`pageerror: ${e.message}`));
      page.__log = lines;
      await use(lines);
      if (info.status === info.expectedStatus) return;
      const errors = await page.locator("p[class*='warn']").allTextContents().catch(() => []);
      if (errors.length) console.log(`Errors shown in the app: ${errors.join(" | ")}`);
      const relevant = lines.filter((l) => !l.includes("React DevTools") && !l.includes("Fast Refresh"));
      console.log(`Page log (last 40 lines):\n${relevant.slice(-40).join("\n")}`);
    },
    { auto: true },
  ],
  run: async ({}, use) => use(readRun()),
  chain: async ({ run }, use) => use(makeChain(run)),
  // Open the app with `account`'s wallet installed and connect it.
  connectAs: async ({ page, run }, use) =>
    use(async (account) => {
      await page.addInitScript(walletScript({ rpcUrl: run.rpcUrl, account }));
      await page.goto("/app");
      await page.getByRole("button", { name: "Connect wallet" }).click();
      await expect(page.getByRole("button", { name: new RegExp(`^${account.slice(0, 6)}`) })).toBeVisible();
    }),
});

// The panel with this heading.
export const panel = (page, title) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

// The figure shown under this label inside a panel.
export const figure = (where, label) => where.locator(`xpath=.//dt[normalize-space()="${label}"]/following-sibling::dd`);

// The block for one ticket.
export const ticket = (page, id) => page.locator(`[data-ticket="${id}"]`);
