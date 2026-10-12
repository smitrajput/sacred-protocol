import { Arrow, Box, Bucket, Cash, Asset, Figure, Person, Text } from "./Figure";
import styles from "./figures.module.css";

// The mechanism page's pictures, all on the running example: 1,000 USDC down on BTC at 3x for
// 14 days at 17% a year. Cost 3,000, financed 2,000, markup 13.04, balance 2,013.04.

const OWED = 2013.04;

// ---- One position in four moves: a strip for someone who has never read a term sheet ----

const panels = [
  {
    title: "You deposit",
    lines: ["Your USDC goes into the vault.", "One vault stands behind every", "desk, BTC and ETH alike."],
    scene: (
      <>
        <Person x={30} y={90} label="You" />
        <Arrow points={[[48, 84], [128, 84]]} />
        <Cash x={88} y={84} text="USDC" />
        <Bucket x={150} y={86} label="Vault" />
      </>
    ),
  },
  {
    title: "The desk buys an asset",
    lines: ["The BTC desk draws 3,000 USDC", "from the vault, pays it on the spot", "market and owns the asset.", "Nothing has been lent."],
    scene: (
      <>
        <Bucket x={32} y={86} label="BTC desk" />
        <Arrow points={[[54, 74], [104, 74]]} />
        <Cash x={79} y={74} text="3,000" />
        <Arrow points={[[104, 100], [54, 100]]} />
        <Asset x={79} y={100} />
        <Box x={108} y={66} w={70} h={42} title="Market" />
      </>
    ),
  },
  {
    title: "It sells the asset on credit",
    lines: ["It sells the asset to a trader on", "credit: cost plus a fixed markup", "of 13.04. 1,000 now, 2,013.04 by", "day 14. The asset stays pledged."],
    scene: (
      <>
        <Bucket x={32} y={86} label="Desk" />
        <Arrow points={[[54, 74], [134, 74]]} />
        <Asset x={94} y={74} />
        <Arrow points={[[134, 102], [54, 102]]} />
        <Cash x={94} y={102} text="1,000 now" />
        <Person x={152} y={90} label="Trader" />
      </>
    ),
  },
  {
    title: "The markup is your yield",
    lines: ["The trader pays. 2,000 goes", "back to the vault; the 13.04 is", "the depositors' yield. That is", "the whole product."],
    scene: (
      <>
        <Person x={26} y={90} label="Trader" />
        <Arrow points={[[42, 84], [70, 84]]} />
        <Cash x={56} y={58} text="2,013.04" />
        <Bucket x={92} y={86} label="Vault" />
        <Arrow points={[[114, 84], [140, 84]]} accent />
        <Cash x={127} y={58} text="13.04" accent />
        <Person x={158} y={90} label="You" />
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
      label="One position in four moves: a depositor's USDC goes into the vault, the asset's desk buys an asset on the spot market, sells it to a trader on credit at cost plus a fixed markup, and when the trader pays the markup goes to the depositors."
      caption="One position, start to finish. No one is lent anything: the desk buys an asset with the vault's money and sells it. The markup is the only charge and the only yield."
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

// ---- What a position records, to scale: the cost split, and the balance that carries down ----

export function Anatomy() {
  const k = 560 / 3000;
  const x0 = 40;
  const xDown = x0 + 1000 * k;
  const xEnd = x0 + 3000 * k;
  return (
    <Figure
      w={640}
      h={182}
      label="The asset cost 3,000: 1,000 down payment and 2,000 financed by the vault. The balance owed by the due date is the same 2,000 plus a fixed markup of 13.04."
      caption="The two sums, to scale. The 2,000 the vault financed comes back as itself; the markup is the thin red slice at the end, fixed at opening and never changed. There is no other charge."
    >
      <text x={x0} y="20" className={styles.big}>
        What the asset cost the vault: 3,000
      </text>
      <rect x={x0} y="30" width={xDown - x0 - 1} height="28" className={styles.barMute} />
      <Text x={(x0 + xDown) / 2} y={48} lines="1,000 · your down payment" className={styles.body} />
      <rect x={xDown + 1} y="30" width={xEnd - xDown - 1} height="28" className={styles.barPaper} />
      <Text x={(xDown + xEnd) / 2} y={48} lines="2,000 · financed by the vault" className={styles.body} />

      <line x1={xDown} y1="58" x2={xDown} y2="110" className={styles.guide} />
      <line x1={xEnd} y1="58" x2={xEnd} y2="110" className={styles.guide} />

      <text x={xDown} y="100" className={styles.big}>
        What you owe by the due date: 2,013.04
      </text>
      <rect x={xDown + 1} y="110" width={xEnd - xDown - 1} height="28" className={styles.barPaper} />
      <Text x={(xDown + xEnd) / 2} y={128} lines="2,000 · the financed amount, back" className={styles.body} />
      <rect x={xEnd + 1} y="110" width="8" height="28" className={styles.barAccent} />
      <path d={`M${xEnd + 5} 138 V 154`} className={`${styles.line} ${styles.accentLine}`} />
      <Text x={xEnd + 5} y={168} anchor="end" lines="+ 13.04 markup, fixed at opening: 2,000 × 17% × 14 ÷ 365" className={styles.labelAccent} />
    </Figure>
  );
}

// ---- How a position ends: the three doors, and who opens them ----

const endings = [
  {
    y: 60,
    who: "Close",
    when: "the trader, any time",
    what: ["The asset is sold on the market.", "The vault takes 2,013.04;", "the trader takes the rest."],
    h: 60,
  },
  {
    y: 162,
    who: "Pay off",
    when: "the trader, any time",
    what: ["The trader pays 2,013.04 in USDC.", "The asset is released to the", "trader's wallet."],
    h: 60,
  },
  {
    y: 268,
    who: "Settlement",
    when: "anyone, after the due date",
    what: ["The asset is sold. The vault takes", "the balance, the trader the surplus.", "If it falls short, the vault takes", "it all and the debt is closed."],
    h: 72,
  },
];

export function Endings() {
  return (
    <Figure
      w={700}
      h={320}
      label="A live position ends one of three ways: the trader closes it and the asset is sold, the trader pays it off and the asset is released, or anyone settles it after the due date and the asset is sold. Part payments reduce the balance and leave the asset pledged."
      caption="Three doors out of a live position. The trader can take the first two at any time, and is not charged for the unused days. The third opens to anyone only after the due date. Every sale is on the open market, never to the vault."
    >
      <Box x={20} y={120} w={150} h={84} title="Live position" sub={["the asset pledged", "balance 2,013.04", "due in 14 days"]} />
      <Arrow d="M120 120 C120 70 70 70 70 120" label={["part payment, any amount:", "the balance falls, the asset stays"]} at={[95, 52]} />
      {endings.map((e) => (
        <g key={e.who}>
          <Arrow points={[[170, 162], [230, 162], [230, e.y], [290, e.y]]} />
          <Box x={290} y={e.y - 22} w={130} h={44} title={e.who} sub={e.when} />
          <Arrow points={[[420, e.y], [470, e.y]]} />
          <Box x={470} y={e.y - e.h / 2} w={215} h={e.h} body={e.what} />
        </g>
      ))}
    </Figure>
  );
}

// ---- Held to the due date: how the asset's value is split, at six prices ----

const rows = [
  ["+20%", 3600, "+59%"],
  ["+10%", 3300, "+29%"],
  ["0%", 3000, "−1%"],
  ["−10%", 2700, "−31%"],
  ["−30%", 2100, "−91%"],
  ["−40%", 1800, "−100%"],
];

const money = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Outcomes() {
  const k = 440 / 3600;
  const x0 = 130;
  const xOwed = x0 + OWED * k;
  const xCost = x0 + 3000 * k;
  return (
    <Figure
      w={700}
      h={290}
      label="At six BTC prices from plus 20 percent to minus 40 percent, the vault's take is always 2,013.04 and the trader takes everything above it. At minus 40 percent the asset sells for 1,800, all of it goes to the vault, and the vault is 213.04 short."
      caption="The sale proceeds at the due date, split. The vault's take is flat: it never earns more than the markup. The trader takes the whole upside and the whole downside, down to the down payment. Below that the vault absorbs the gap, 200 of principal and no markup. Before the trader's profit share."
    >
      <g>
        <rect x={x0} y="22" width="14" height="10" className={styles.barMute} />
        <Text x={x0 + 20} y={31} anchor="start" lines="the vault's take" className={styles.sub} />
        <rect x={x0 + 140} y="22" width="14" height="10" className={styles.barHatch} />
        <Text x={x0 + 160} y={31} anchor="start" lines="the trader's take" className={styles.sub} />
        <rect x={x0 + 280} y="22" width="14" height="10" className={styles.barShort} />
        <Text x={x0 + 300} y={31} anchor="start" lines="short of what is owed" className={styles.sub} />
      </g>
      <line x1={xOwed} y1="56" x2={xOwed} y2="280" className={styles.guide} />
      <Text x={xOwed} y={52} lines="owed to the vault: 2,013.04" className={styles.labelMute} />
      <line x1={xCost} y1="56" x2={xCost} y2="280" className={styles.guide} />
      <Text x={xCost + 60} y={52} lines="cost: 3,000" className={styles.labelMute} />
      {rows.map(([move, value, pct], i) => {
        const y = 62 + i * 36;
        const bucket = Math.min(value, OWED);
        const trader = value - bucket;
        const short = OWED - bucket;
        const end = x0 + Math.max(value, OWED) * k;
        return (
          <g key={move}>
            <Text x={8} y={y + 15} anchor="start" lines={`BTC ${move}`} className={styles.big} />
            <Text x={72} y={y + 15} anchor="start" lines={value.toLocaleString("en-US")} className={styles.sub} />
            <rect x={x0} y={y} width={bucket * k - 1} height="22" className={styles.barMute} />
            <Text x={x0 + 6} y={y + 15} anchor="start" lines={money(bucket)} className={styles.body} />
            {trader > 0 && <rect x={x0 + bucket * k + 1} y={y} width={trader * k - 1} height="22" className={styles.barHatch} />}
            {short > 0 && <rect x={x0 + bucket * k + 1} y={y} width={short * k - 1} height="22" className={styles.barShort} />}
            <text x={end + 8} y={y + 15} className={styles.body}>
              {short > 0 ? <tspan className={styles.labelAccent}>short {money(short)}</tspan> : <tspan>{money(trader)}</tspan>}
              <tspan className={styles.sub}>{`  ${pct} for the trader`}</tspan>
            </text>
          </g>
        );
      })}
    </Figure>
  );
}
