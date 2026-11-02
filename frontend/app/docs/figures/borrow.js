import { borrowQuote, earlySettlement, usd } from "../../../lib/quote";
import { Arrow, Box, Figure, Text } from "./Figure";
import styles from "./figures.module.css";

// The Borrow pages' pictures, on the audited reference: collateral worth 10,000, 45% entry, 30
// days, 8% annualized. The 8% is a reference, not a launch quote.

const q = borrowQuote({ collateral: 10_000 });
const early = earlySettlement({ usdc: q.usdc, day: 7 });

export function BorrowFlow() {
  return (
    <Figure
      w={760}
      h={190}
      min={680}
      label={`Pledge collateral worth 10,000. Receive ${usd(q.usdc, 0)} USDC to spend. Repay a fixed ${usd(q.debt)} USDC by day 30, or less if you settle early. Your collateral is released.`}
      caption="The collateral stays yours throughout. It is pledged, never lent, staked or reused. Figures use the 8% reference, not a launch quote."
    >
      <Box x={10} y={36} w={170} h={92} title="Pledge" sub={["collateral worth $10,000", "WETH or cirBTC", "still yours"]} />
      <Arrow points={[[180, 82], [290, 82]]} label="sale accepted" at={[235, 74]} />
      <Box x={290} y={36} w={170} h={92} title="Receive" sub={[`${usd(q.usdc, 0)} USDC`, "spendable at once", `fixed price ${usd(q.debt)}`]} kind="accent" />
      <Arrow points={[[460, 82], [570, 82]]} label="by day 30" at={[515, 74]} />
      <Box x={570} y={36} w={180} h={92} title="Repay, then release" sub={[`${usd(q.debt)} at day 30`, `${usd(early.settle)} at day 7`, "collateral returned"]} />
      <Text x={10} y={160} anchor="start" lines={`Liquidation begins if the collateral falls to $${usd(q.triggerValue)}, a ${(q.priceRoom * 100).toFixed(1)}% fall. Only what is needed is sold, and any surplus is yours.`} className={styles.labelMute} />
    </Figure>
  );
}

export function BorrowStates() {
  const states = [
    ["Quoted", "price, term, rebate rule, collateral rights and costs shown; no debt yet"],
    ["Funded", "inventory and collateral verified; USDC delivered; fixed debt recorded"],
    ["Active", "add collateral, repay in part or full, withdraw within limits"],
    ["Due", "full debt due; no extra markup; 24-hour cure for healthy accounts"],
    ["Paid", "debt settled from your own funds or an authorized sale; surplus returned"],
  ];
  return (
    <Figure
      w={680}
      h={214}
      min={560}
      label="A sale moves through five states: quoted, funded, active, due and paid. A new sale is a separate transaction with its own funding."
      caption="A sale's states. Price-triggered liquidation stays available in every funded state, including the 24-hour cure. A new sale needs new underwriting and real delivery, and never funds the old debt."
    >
      {states.map(([name, line], i) => {
        const y = 8 + i * 41;
        return (
          <g key={name}>
            <rect x={10} y={y} width={660} height={34} rx="2" className={i === 2 ? styles.accent : styles.paper} />
            <text x={24} y={y + 22} className={styles.title}>
              {name}
            </text>
            <Text x={120} y={y + 22} anchor="start" lines={line} className={styles.sub} />
          </g>
        );
      })}
    </Figure>
  );
}
