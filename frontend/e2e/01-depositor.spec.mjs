import { ACCOUNTS, DAY, USDC } from "./chain.mjs";
import { expect, figure, panel, test } from "./fixtures.mjs";

// The manager seeds the bucket (it must hold at least 5% of it), then a depositor queues USDC,
// the keeper prices it at the weekly cut-off, the depositor claims shares, queues part of them
// for withdrawal, and claims the USDC after the next cut-off. The API counts their USDC-days as
// points along the way.
test("depositor: in at the cut-off, out at the share price", async ({ page, chain, connectAs }) => {
  const me = ACCOUNTS.depositor;
  await chain.seedManager(10_000n * USDC);
  await chain.mintUsdc(me, 200_000n * USDC);
  await connectAs(me);
  const earn = panel(page, "Earn");

  await earn.getByLabel("Deposit, USDC").fill("100000");
  await earn.getByRole("button", { name: "Request deposit" }).click();
  await expect(earn).toContainText("Queued deposit: 100,000.00 USDC");
  await expect(figure(earn, "Your shares")).toHaveText("0.00");

  // The keeper runs the cut-off once it is due.
  await chain.travel(7 * DAY + 1);
  await expect.poll(() => chain.epoch(), { timeout: 20_000 }).toBe(2n);
  await earn.getByRole("button", { name: "Claim shares" }).click();
  await expect(figure(earn, "Your shares")).toHaveText("100,000.00");
  await expect(earn).toContainText("Queued deposit: 0.00 USDC");
  await expect(figure(earn, "In the bucket")).toHaveText("110,000.00 USDC"); // with the manager's 10,000

  await earn.getByLabel("Withdraw, shares").fill("10000");
  await earn.getByRole("button", { name: "Request withdrawal" }).click();
  await expect(earn).toContainText("Queued withdrawal: 10,000.00 shares");
  await expect(figure(earn, "Your shares")).toHaveText("90,000.00");

  await chain.travel(7 * DAY);
  await expect.poll(() => chain.epoch(), { timeout: 20_000 }).toBe(3n);
  await earn.getByRole("button", { name: "Claim USDC" }).click();
  await expect(earn).toContainText("Queued withdrawal: 0.00 shares");
  await expect.poll(() => chain.usdcOf(me)).toBe(110_000n * USDC);

  // 90,000 shares at a share price of 1.00 held through one cut-off: 630,000 USDC-days.
  await expect(page.getByText("630,000 points")).toBeVisible();
});
