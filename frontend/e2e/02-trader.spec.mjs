import { ACCOUNTS, DAY, USDC } from "./chain.mjs";
import { expect, figure, panel, test, position } from "./fixtures.mjs";

// A trader opens the design's example position, part-pays it, closes it in profit, pays a second
// one off to take the asset, and leaves a third to the keeper, which settles it after the due
// date and leaves the surplus waiting for them.
test("trader: open, part pay, close, pay off, and be settled", async ({ page, chain, connectAs }) => {
  const me = ACCOUNTS.trader;
  await chain.mintUsdc(me, 10_000n * USDC);
  await connectAs(me);
  const form = panel(page, "Buy BTC now, pay the rest later");
  const open = async () => {
    await form.getByRole("button", { name: "Open position" }).click();
  };

  // 1,000 down at 3x for 14 days: the vault buys 3,000 of BTC and the trader owes 2,008.44.
  await form.getByLabel("Down payment, USDC").fill("1000");
  await form.getByLabel("3x").check();
  await form.getByLabel("14 days").check();
  await expect(form).toContainText("2,008.44");
  await open();
  await expect(position(page, 1)).toContainText("Live");
  await expect(figure(position(page, 1), "BTC")).toHaveText("0.0500");

  // A part payment lowers what settles the position.
  await position(page, 1).getByLabel("Part payment for position 1").fill("100");
  await position(page, 1).getByRole("button", { name: "Part pay" }).click();
  await expect.poll(async () => (await chain.position(1n)).repaid, { timeout: 20_000 }).toBe(100n * USDC);
  await expect(figure(position(page, 1), "To settle today")).toHaveText(/^1,900\./);

  // BTC rises 20%: the close sells the asset, the vault takes the settlement amount, the trader
  // keeps 70% of the profit.
  await chain.setPrice(72_000);
  await expect(figure(position(page, 1), "Worth now")).toHaveText("3,600.00");
  await expect(figure(position(page, 1), "You would get")).not.toHaveText("under water");
  await position(page, 1).getByRole("button", { name: "Close" }).click();
  await expect(position(page, 1)).toContainText("Closed");
  const afterClose = await chain.usdcOf(me);
  expect(afterClose).toBeGreaterThan(10_000n * USDC - 1_100n * USDC + 1_500n * USDC); // 1,100 in, well over 1,500 back

  // Pay off: the balance in USDC, the asset to the wallet.
  await open();
  await expect(position(page, 2)).toContainText("Live");
  await position(page, 2).getByRole("button", { name: "Pay off" }).click();
  await expect(position(page, 2)).toContainText("Paid off");
  expect(await chain.assetOf(me)).toBeGreaterThan(0n);

  // Left alone past the due date, the keeper settles it and the surplus waits to be collected.
  await open();
  await expect(position(page, 3)).toContainText("Live");
  await chain.travel(15 * DAY);
  await expect(position(page, 3)).toContainText("Settled", { timeout: 40_000 });
  await expect(page.getByText(/USDC is waiting for you from settled positions/)).toBeVisible();
  const beforeCollect = await chain.usdcOf(me);
  await page.getByRole("button", { name: "Collect" }).click();
  await expect(page.getByText(/USDC is waiting for you/)).toHaveCount(0);
  expect(await chain.usdcOf(me)).toBeGreaterThan(beforeCollect + 900n * USDC);

  // Markup paid on three positions counts as trading points.
  await expect(page.getByText(/\d+ points/)).toBeVisible();
});
