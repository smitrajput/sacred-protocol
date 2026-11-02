import { Arrow, Box, Figure, Text } from "./Figure";
import styles from "./figures.module.css";

// The architecture and risk pictures: the two isolated vaults on shared infrastructure, the
// proposed trade engine's call path, and the order a Trade shortfall is absorbed in.

// ---- Two balance sheets, one set of tools ----

export function Vaults() {
  return (
    <Figure
      w={760}
      h={300}
      min={680}
      label="MarginVault funds Trade and holds depositors, debts, vintages and earned protection. CashFinanceVault funds Borrow and holds investors, sales, investor reserves and loss carry. Both use shared libraries, adapters, keepers and UI, but neither can spend from the other."
      caption="One financing vision, two isolated balance sheets. Shared libraries share code, not losses: neither vault has a spending approval over the other."
    >
      <rect x={10} y={10} width={350} height={150} rx="2" className={styles.ghost} />
      <text x={24} y={30} className={styles.big}>
        MarginVault
      </text>
      <Text x={24} y={46} anchor="start" lines="Earn deposits fund Trade" className={styles.sub} />
      <Box x={24} y={60} w={158} h={86} title="BTC and ETH debt books" sub={["tier and vintage accounting", "weighted risk capacity"]} />
      <Box x={190} y={60} w={158} h={86} title="Earned protection" sub={["manager-owned cash", "primary and tail"]} />

      <rect x={400} y={10} width={350} height={150} rx="2" className={styles.ghost} />
      <text x={414} y={30} className={styles.big}>
        CashFinanceVault
      </text>
      <Text x={414} y={46} anchor="start" lines="12-month investors fund Borrow" className={styles.sub} />
      <Box x={414} y={60} w={158} h={86} title="USDC sales" sub={["vintage records", "route and maturity caps"]} />
      <Box x={580} y={60} w={158} h={86} title="Investment risk reserve" sub={["investor-owned", "primary and tail sleeves"]} />

      <Arrow points={[[185, 160], [185, 210]]} />
      <Arrow points={[[575, 160], [575, 210]]} />
      <Text x={380} y={92} lines={["no", "spending", "approval"]} className={styles.labelAccent} />

      <rect x={10} y={210} width={740} height={78} rx="2" className={styles.paper} />
      <text x={380} y={232} textAnchor="middle" className={styles.title}>
        Shared infrastructure
      </text>
      <Text x={380} y={252} lines={["Sale and pledge libraries · validated oracles · token adapters · keepers and routing", "Monitoring, notifications and UI · audit and test infrastructure"]} className={styles.sub} />
    </Figure>
  );
}

// ---- A Trade position through the proposed engine ----

export function Engine() {
  const steps = [
    ["Account ledger", ["unitized NAV, daily", "checkpoints, 52 weeks"]],
    ["Score engine", ["one weekly transition,", "published formula"]],
    ["Capacity controller", ["ceiling, headroom,", "every portfolio limit"]],
    ["Margin engine", ["purchase, sale, pledge,", "partial sale, settlement"]],
  ];
  return (
    <Figure
      w={760}
      h={176}
      min={680}
      label="The account ledger feeds the score engine, which feeds the capacity controller, which authorizes the margin engine. The margin engine reports every economic action back to the ledger. Coverage-based partial sales run in the margin engine independently of the score."
      caption="Canonical ledger, then score, then capacity checks. Liquidation and settlement run independently of the score, and an indexer only displays results."
    >
      {steps.map(([title, sub], i) => {
        const x = 10 + i * 190;
        return (
          <g key={title}>
            <Box x={x} y={16} w={160} h={70} title={title} sub={sub} />
            {i < 3 && <Arrow points={[[x + 160, 51], [x + 190, 51]]} />}
          </g>
        );
      })}
      <Arrow points={[[650, 86], [650, 130], [90, 130], [90, 86]]} label="every economic action, hooked into the ledger exactly once" at={[370, 124]} />
      <Text x={650} y={152} anchor="middle" lines="partial sales run here, on coverage alone" className={styles.labelMute} />
    </Figure>
  );
}

// ---- The order a Trade shortfall is absorbed in ----

const layers = [
  ["The trader's capital", "it sits under the financing"],
  ["Primary protection", "earned manager cash, target 0.4% of approved financing"],
  ["Tail protection", "earned manager cash, target 0.6% of approved financing"],
  ["Pilot backstop", "capital set aside from Sacred's raise for the pilot phase"],
  ["Every depositor of the vault", "in proportion, through active NAV"],
];

export function LossOrder() {
  return (
    <Figure
      w={640}
      h={250}
      min={540}
      label="A shortfall is absorbed in order by the trader's capital, primary protection, tail protection and the pilot backstop. Only what is left reaches depositors, through active NAV."
      caption="When a pledged asset falls, the loss moves through these layers in order. Four layers stand in front of depositor principal."
    >
      <Text x={10} y={26} anchor="start" lines="A loss" className={styles.big} />
      <Text x={10} y={44} anchor="start" lines={["what one layer", "cannot cover", "falls to the next"]} className={styles.sub} />
      <Arrow points={[[100, 14], [100, 236]]} />
      {layers.map(([name, note], i) => {
        const y = 14 + i * 46;
        const last = i === layers.length - 1;
        return (
          <g key={name}>
            <rect x={130} y={y} width={500} height={38} rx="2" className={last ? styles.accent : styles.paper} />
            <text x={146} y={y + 23} className={styles.num}>
              {i + 1}
            </text>
            <text x={162} y={y + 23} className={styles.title}>
              {name}
            </text>
            <Text x={618} y={y + 23} anchor="end" lines={note} className={styles.sub} />
          </g>
        );
      })}
    </Figure>
  );
}
