import { tradeQuote, partialSale, usd } from "../../../lib/quote";
import { Arrow, Asset, Box, Bucket, Cash, Figure, Person, Text } from "./Figure";
import styles from "./figures.module.css";

// The Trade pages' pictures, all on the running example: a 10,000 BTC purchase at 2× for 14 days.
// Every figure comes from lib/quote.js, the same arithmetic the landing page's quote uses.

const q = tradeQuote({ contribution: 5_000 });
const s = partialSale({ debt: q.debt, trigger: q.tier.trigger, restore: q.tier.restore });

// ---- The whole cost, to scale against the whole position ----

export function Quote() {
  const rows = [
    ["Your capital", q.contribution],
    ["Financing", q.financing],
    ["Asset bought", q.exposure],
    ["Fixed markup", q.markup],
    ["Assumed execution", q.execution],
  ];
  return (
    <Figure
      w={640}
      h={176}
      min={520}
      label={`Your capital of ${usd(q.contribution)} and financing of ${usd(q.financing)} buy ${usd(q.exposure)} of asset. Fixed markup ${usd(q.markup)} plus assumed execution ${usd(q.execution)} is ${usd(q.totalCost)} in total.`}
      caption="One position, priced before you buy. The cost is a dollar figure from the moment of the sale; it does not move with the market."
    >
      <rect x={20} y={20} width={299} height={34} className={styles.barMute} />
      <Text x={170} y={42} lines={`Your capital ${usd(q.contribution, 0)}`} className={styles.body} />
      <rect x={321} y={20} width={299} height={34} className={styles.barPaper} />
      <Text x={470} y={42} lines={`Financing ${usd(q.financing, 0)}`} className={styles.body} />
      <Text x={20} y={78} anchor="start" lines={`Together they buy ${usd(q.exposure, 0)} of BTC, pledged to the vault until the debt is paid.`} className={styles.sub} />
      <line x1={20} y1={96} x2={620} y2={96} className={styles.rule} />
      {rows.slice(3).map(([name, value], i) => (
        <g key={name}>
          <Text x={20} y={120 + i * 20} anchor="start" lines={name} className={styles.body} />
          <Text x={620} y={120 + i * 20} anchor="end" lines={`$${usd(value)}`} className={styles.body} />
        </g>
      ))}
      <Text x={20} y={164} anchor="start" lines="Total cost at constant price" className={styles.big} />
      <Text x={620} y={164} anchor="end" lines={`$${usd(q.totalCost)}`} className={styles.big} />
    </Figure>
  );
}

// ---- One position in four moves ----

const panels = [
  {
    title: "You bring capital",
    lines: ["$5,000 of your USDC goes in", "first. Financing never comes", "without your own capital."],
    scene: (
      <>
        <Person x={30} y={90} label="You" />
        <Arrow points={[[48, 84], [128, 84]]} />
        <Cash x={88} y={84} text="$5,000" />
        <Bucket x={150} y={86} label="Vault" />
      </>
    ),
  },
  {
    title: "The vault buys",
    lines: ["It pays $10,000 on the spot", "market and owns the asset.", "Nothing has been lent."],
    scene: (
      <>
        <Bucket x={32} y={86} label="Vault" />
        <Arrow points={[[54, 74], [104, 74]]} />
        <Cash x={79} y={74} text="$10,000" />
        <Arrow points={[[104, 100], [54, 100]]} />
        <Asset x={79} y={100} />
        <Box x={108} y={66} w={70} h={42} title="Market" />
      </>
    ),
  },
  {
    title: "It sells to you",
    lines: ["At cost plus a fixed markup of", "$19.18. You owe $5,019.18 by", "day 14. The asset is yours,", "pledged as security."],
    scene: (
      <>
        <Bucket x={32} y={86} label="Vault" />
        <Arrow points={[[54, 74], [134, 74]]} />
        <Asset x={94} y={74} />
        <Arrow points={[[134, 102], [54, 102]]} />
        <Cash x={94} y={102} text="$5,019.18 due" />
        <Person x={152} y={90} label="You" />
      </>
    ),
  },
  {
    title: "The markup is shared",
    lines: ["You repay. Of the $19.18,", "77% goes to depositors and", "23% to the manager. Any gain", "on the asset stays with you."],
    scene: (
      <>
        <Person x={26} y={90} label="You" />
        <Arrow points={[[42, 84], [70, 84]]} />
        <Cash x={56} y={58} text="$5,019.18" />
        <Bucket x={92} y={86} label="Vault" />
        <Arrow points={[[114, 84], [140, 84]]} accent />
        <Cash x={127} y={58} text="$14.77" accent />
        <Person x={158} y={90} label="Depositors" />
      </>
    ),
  },
];

export function Strip() {
  const W = 181;
  const GAP = 12;
  return (
    <Figure
      w={760}
      h={212}
      min={700}
      label="One position in four moves: you bring capital, the vault buys the asset on the spot market, sells it to you at cost plus a fixed markup, and when you repay the markup is shared between depositors and the manager."
      caption="One position, start to finish. The vault buys an asset and sells it. The markup is fixed at the sale and is the depositors' source of income."
    >
      {panels.map((p, i) => (
        <g key={p.title} transform={`translate(${i * (W + GAP)} 0)`}>
          {i > 0 && <line x1={-GAP / 2} y1="4" x2={-GAP / 2} y2="208" className={styles.rule} />}
          <text x="0" y="16" className={styles.num}>
            {i + 1}
          </text>
          <text x="14" y="16" className={styles.big}>
            {p.title}
          </text>
          {p.scene}
          <Text x={0} y={154} anchor="start" lines={p.lines} className={styles.labelMute} />
        </g>
      ))}
    </Figure>
  );
}

// ---- What a position records, to scale ----

export function Anatomy() {
  const k = 560 / q.exposure;
  const x0 = 40;
  const xDown = x0 + q.contribution * k;
  const xEnd = x0 + q.exposure * k;
  return (
    <Figure
      w={640}
      h={182}
      label="The asset cost 10,000: 5,000 of your capital and 5,000 financed by the vault. The debt owed by day 14 is the same 5,000 plus a fixed markup of 19.18."
      caption="The two sums, to scale. The financing comes back as itself; the markup is the thin red slice at the end, fixed at the sale."
    >
      <text x={x0} y="20" className={styles.big}>
        What the asset cost: $10,000
      </text>
      <rect x={x0} y="30" width={xDown - x0 - 1} height="28" className={styles.barMute} />
      <Text x={(x0 + xDown) / 2} y={48} lines="$5,000 · your capital" className={styles.body} />
      <rect x={xDown + 1} y="30" width={xEnd - xDown - 1} height="28" className={styles.barPaper} />
      <Text x={(xDown + xEnd) / 2} y={48} lines="$5,000 · financed by the vault" className={styles.body} />
      <line x1={xDown} y1="58" x2={xDown} y2="110" className={styles.guide} />
      <line x1={xEnd} y1="58" x2={xEnd} y2="110" className={styles.guide} />
      <text x={xDown} y="100" className={styles.big}>
        What you owe by day 14: $5,019.18
      </text>
      <rect x={xDown + 1} y="110" width={xEnd - xDown - 1} height="28" className={styles.barPaper} />
      <Text x={(xDown + xEnd) / 2} y={128} lines="$5,000 · the financing, back" className={styles.body} />
      <rect x={xEnd + 1} y="110" width="8" height="28" className={styles.barAccent} />
      <path d={`M${xEnd + 5} 138 V 154`} className={`${styles.line} ${styles.accentLine}`} />
      <Text x={xEnd + 5} y={168} anchor="end" lines="+ $19.18 markup, fixed at the sale: 5,000 × 10% × 14 ÷ 365" className={styles.labelAccent} />
    </Figure>
  );
}

// ---- A partial sale: less asset, less debt, the same equity ----

export function PartialSale() {
  const k = 480 / 10_000;
  const x0 = 120;
  const rows = [
    ["Opening", q.exposure * 0.9995, q.debt],
    ["At 160%", s.asset, q.debt],
    ["At 190%", s.assetAfter, s.debtAfter],
  ];
  return (
    <Figure
      w={660}
      h={170}
      min={540}
      label={`At opening the asset is worth about 9,995 against 5,019 of debt. At 160% coverage it is worth ${usd(s.asset, 0)}. The partial sale of ${usd(s.sold, 0)} leaves ${usd(s.assetAfter, 0)} of asset against ${usd(s.debtAfter, 0)} of debt, and the trader's equity is unchanged.`}
      caption="A partial sale shrinks the position and restores coverage. Your equity is the unhatched gap, and the sale itself leaves it unchanged, before sale costs and any approved rebate."
    >
      {rows.map(([name, asset, debt], i) => {
        const y = 18 + i * 50;
        return (
          <g key={name}>
            <Text x={8} y={y + 19} anchor="start" lines={name} className={styles.big} />
            <rect x={x0} y={y} width={debt * k} height="28" className={styles.barHatch} />
            <rect x={x0 + debt * k + 1} y={y} width={(asset - debt) * k - 1} height="28" className={styles.barMute} />
            <Text x={x0 + 6} y={y + 19} anchor="start" lines={`debt $${usd(debt, 0)}`} className={styles.body} />
            <Text x={x0 + debt * k + 8} y={y + 19} anchor="start" lines={`equity $${usd(asset - debt, 0)}`} className={styles.body} />
            <Text x={x0 + asset * k + 8} y={y + 19} anchor="start" lines={`$${usd(asset, 0)}`} className={styles.sub} />
          </g>
        );
      })}
    </Figure>
  );
}

// ---- The SIFT loop: real outcomes update the next decision ----

export function SiftLoop() {
  const steps = [
    ["Own capital", ["plus small", "financing"]],
    ["Verifiable", ["performance,", "whole account"]],
    ["Capacity", ["grows by the day,", "cuts at once"]],
    ["Collected", ["markup, after", "losses and costs"]],
  ];
  return (
    <Figure
      w={760}
      h={150}
      min={640}
      label="Four steps in a loop: own capital plus small financing, verifiable performance across the whole account, capacity that grows by the qualifying day and cuts at once, and collected markup. New outcomes update the next decision."
      caption="Each qualifying day uses new real outcomes. Nothing here depends on a simulated stage."
    >
      {steps.map(([title, sub], i) => {
        const x = 16 + i * 186;
        return (
          <g key={title}>
            <Box x={x} y={18} w={150} h={72} title={title} sub={sub} kind={i === 2 ? "accent" : "paper"} />
            {i < 3 && <Arrow points={[[x + 150, 54], [x + 186, 54]]} />}
          </g>
        );
      })}
      <Arrow points={[[670, 90], [670, 124], [90, 124], [90, 90]]} label="new outcomes update the next decision" at={[380, 118]} />
    </Figure>
  );
}
