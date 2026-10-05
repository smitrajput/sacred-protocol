import { ACCOUNTS, DAY, SCR } from "./chain.mjs";
import { expect, figure, panel, test } from "./fixtures.mjs";

// A staker puts SCR behind the buckets, is streamed USDC from the trader's profit share, claims
// it, asks to leave, waits out the cooldown, and takes the SCR back out.
test("staker: stake, earn USDC, and leave after the cooldown", async ({ page, chain, connectAs }) => {
  const me = ACCOUNTS.staker;
  await chain.giveScr(me, 50_000n * SCR);
  await connectAs(me);
  const stake = panel(page, "Stake SCR");
  await expect(figure(stake, "Your SCR")).toHaveText("50,000");

  // The trader's profitable close left USDC in the fund.
  await expect(figure(stake, "USDC it can pay")).not.toHaveText("0.00 USDC");

  await stake.getByLabel("Stake, SCR", { exact: true }).fill("10000");
  await stake.getByRole("button", { name: "Stake", exact: true }).click();
  await expect(figure(stake, "Your stake")).toHaveText("10,000 SCR");
  await expect(figure(stake, "Staked in the fund")).toHaveText("10,000 SCR");
  await expect(figure(stake, "Your SCR")).toHaveText("40,000");

  // A day of the 90 day stream.
  await chain.travel(DAY);
  await expect(figure(stake, "USDC earned")).not.toHaveText("0.00");
  await stake.getByRole("button", { name: "Claim USDC" }).click();
  await expect.poll(() => chain.usdcOf(me)).toBeGreaterThan(0n);

  // Leaving: a 14 day cooldown, then a window.
  await stake.getByLabel("Unstake, SCR").fill("10000");
  await stake.getByRole("button", { name: "Request unstake" }).click();
  await expect(stake).toContainText("10,000 SCR cooling down until");
  await expect(stake.getByRole("button", { name: "Take SCR out" })).toHaveCount(0);

  await chain.travel(14 * DAY);
  await expect(stake).toContainText("10,000 SCR ready to take out until");
  await stake.getByRole("button", { name: "Take SCR out" }).click();
  await expect(figure(stake, "Your stake")).toHaveText("0 SCR");
  await expect(figure(stake, "Your SCR")).toHaveText("50,000");
  expect(await chain.stakeOf(me)).toBe(0n);
});
