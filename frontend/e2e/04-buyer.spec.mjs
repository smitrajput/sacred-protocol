import { ACCOUNTS, SCR, USDC, format } from "./chain.mjs";
import { expect, figure, panel, test } from "./fixtures.mjs";

// An SCR buyer pays USDC into the liquidity reserve for new SCR, which arrives staked in the
// backstop fund.
test("buyer: new SCR for USDC, straight into the reserve, delivered staked", async ({ page, chain, connectAs }) => {
  const me = ACCOUNTS.buyer;
  await chain.mintUsdc(me, 10_000n * USDC);
  await connectAs(me);
  const sale = panel(page, "Buy SCR from the reserve");
  await expect(sale).toContainText("Open");

  // The price is the pool's average less the discount, since the reserve is still thin.
  const price = await chain.salePrice();
  expect(price).toBeGreaterThan(90_000n);
  expect(price).toBeLessThan(100_000n);
  await expect(figure(sale, "Price per SCR")).toHaveText(`${format(price, 6, 4)} USDC`);

  const cost = (1_000n * SCR * price + SCR - 1n) / SCR;
  await sale.getByLabel("Buy, SCR").fill("1000");
  await expect(sale).toContainText(`${format(cost, 6)} USDC`);
  const reserveBefore = await chain.reserveAssets();
  await sale.getByRole("button", { name: "Buy SCR" }).click();

  await expect(figure(panel(page, "Stake SCR"), "Your stake")).toHaveText("1,000 SCR");
  await expect.poll(() => chain.reserveAssets()).toBe(reserveBefore + cost);
  expect(await chain.usdcOf(me)).toBe(10_000n * USDC - cost);
  expect(await chain.scrOf(me)).toBe(0n); // staked, not in the wallet
});
