import { Arrow, Box, Bucket, Cash, Coin, Figure, Person, Text } from "./Figure";
import styles from "./figures.module.css";

// The mechanism page's pictures, all on the running example: 1,000 USDC down on BTC at 3x for
// 14 days at 11% a year. Cost 3,000, financed 2,000, markup 8.44, balance 2,008.44.

const OWED = 2008.44;

// ---- One ticket in four moves: a strip for someone who has never read a term sheet ----

const panels = [
  {
    title: "You deposit",
    lines: ["Your USDC goes into a bucket:", "one per coin, BTC or ETH.", "Buckets share nothing."],
    scene: (
      <>
        <Person x={30} y={90} label="You" />
        <Arrow points={[[48, 84], [128, 84]]} />
        <Cash x={88} y={84} text="USDC" />
        <Bucket x={150} y={86} label="BTC bucket" />
      </>
    ),
  },
  {
    title: "The bucket buys a coin",
    lines: ["The bucket pays 3,000 USDC on", "the spot market and owns the", "coin. Nothing has been lent."],
    scene: (
      <>
        <Bucket x={32} y={86} label="Bucket" />
        <Arrow points={[[54, 74], [104, 74]]} />
        <Cash x={79} y={74} text="3,000" />
        <Arrow points={[[104, 100], [54, 100]]} />
        <Coin x={79} y={100} />
        <Box x={108} y={66} w={70} h={42} title="Market" />
      </>
    ),
  },
  {
    title: "It sells the coin on credit",
    lines: ["It sells the coin to a trader on", "credit: cost plus a fixed markup", "of 8.44. 1,000 now, 2,008.44 by", "day 14. The coin stays pledged."],
    scene: (
      <>
        <Bucket x={32} y={86} label="Bucket" />
        <Arrow points={[[54, 74], [134, 74]]} />
        <Coin x={94} y={74} />
        <Arrow points={[[134, 102], [54, 102]]} />
        <Cash x={94} y={102} text="1,000 now" />
        <Person x={152} y={90} label="Trader" />
      </>
    ),
  },
  {
    title: "The markup is your yield",
    lines: ["The trader pays. 2,000 goes", "back to work; the 8.44 is the", "depositors' yield. That is the", "whole product."],
    scene: (
      <>
        <Person x={26} y={90} label="Trader" />
        <Arrow points={[[42, 84], [70, 84]]} />
        <Cash x={56} y={58} text="2,008.44" />
        <Bucket x={92} y={86} label="Bucket" />
        <Arrow points={[[114, 84], [140, 84]]} accent />
        <Cash x={127} y={58} text="8.44" accent />
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
      label="One ticket in four moves: a depositor's USDC fills a bucket, the bucket buys a coin on the spot market, sells it to a trader on credit at cost plus a fixed markup, and when the trader pays the markup goes to the depositors."
      caption="One ticket, start to finish. No one is lent anything: the bucket buys a coin and sells it. The markup is the only charge and the only yield."
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

// ---- What a ticket records, to scale: the cost split, and the balance that carries down ----

export function Anatomy() {
  const k = 560 / 3000;
  const x0 = 40;
  const xDown = x0 + 1000 * k;
  const xEnd = x0 + 3000 * k;
  return (
    <Figure
      w={640}
      h={182}
      label="The coin cost 3,000: 1,000 down payment and 2,000 financed by the bucket. The balance owed by the due date is the same 2,000 plus a fixed markup of 8.44."
      caption="The two sums, to scale. The 2,000 the bucket financed comes back as itself; the markup is the thin red slice at the end, fixed at opening and never changed. There is no other charge."
    >
      <text x={x0} y="20" className={styles.big}>
        What the coin cost the bucket: 3,000
      </text>
      <rect x={x0} y="30" width={xDown - x0 - 1} height="28" className={styles.barMute} />
      <Text x={(x0 + xDown) / 2} y={48} lines="1,000 · your down payment" className={styles.body} />
      <rect x={xDown + 1} y="30" width={xEnd - xDown - 1} height="28" className={styles.barPaper} />
      <Text x={(xDown + xEnd) / 2} y={48} lines="2,000 · financed by the bucket" className={styles.body} />

      <line x1={xDown} y1="58" x2={xDown} y2="110" className={styles.guide} />
      <line x1={xEnd} y1="58" x2={xEnd} y2="110" className={styles.guide} />

      <text x={xDown} y="100" className={styles.big}>
        What you owe by the due date: 2,008.44
      </text>
      <rect x={xDown + 1} y="110" width={xEnd - xDown - 1} height="28" className={styles.barPaper} />
      <Text x={(xDown + xEnd) / 2} y={128} lines="2,000 · the financed amount, back" className={styles.body} />
      <rect x={xEnd + 1} y="110" width="8" height="28" className={styles.barAccent} />
      <path d={`M${xEnd + 5} 138 V 154`} className={`${styles.line} ${styles.accentLine}`} />
      <Text x={xEnd + 5} y={168} anchor="end" lines="+ 8.44 markup, fixed at opening: 2,000 × 11% × 14 ÷ 365" className={styles.labelAccent} />
    </Figure>
  );
}

// ---- How a ticket ends: the three doors, and who opens them ----

const endings = [
  {
    y: 60,
    who: "Close",
    when: "the trader, any time",
    what: ["The coin is sold on the market.", "The bucket takes 2,008.44;", "the trader takes the rest."],
    h: 60,
  },
  {
    y: 162,
    who: "Pay off",
    when: "the trader, any time",
    what: ["The trader pays 2,008.44 in USDC.", "The coin is released to the", "trader's wallet."],
    h: 60,
  },
  {
    y: 268,
    who: "Settlement",
    when: "anyone, after the due date",
    what: ["The coin is sold. The bucket takes", "the balance, the trader the surplus.", "If it falls short, the bucket takes", "it all and the debt is closed."],
    h: 72,
  },
];

export function Endings() {
  return (
    <Figure
      w={700}
      h={320}
      label="A live ticket ends one of three ways: the trader closes it and the coin is sold, the trader pays it off and the coin is released, or anyone settles it after the due date and the coin is sold. Part payments reduce the balance and leave the coin pledged."
      caption="Three doors out of a live ticket. The trader can take the first two at any time, and is not charged for the unused days. The third opens to anyone only after the due date. Every sale is on the open market, never to the vault."
    >
      <Box x={20} y={120} w={150} h={84} title="Live ticket" sub={["the coin pledged", "balance 2,008.44", "due in 14 days"]} />
      <Arrow d="M120 120 C120 70 70 70 70 120" label={["part payment, any amount:", "the balance falls, the coin stays"]} at={[95, 52]} />
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

// ---- Held to the due date: how the coin's value is split, at six prices ----

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
      label="At six BTC prices from plus 20 percent to minus 40 percent, the bucket's take is always 2,008.44 and the trader takes everything above it. At minus 40 percent the coin sells for 1,800, all of it goes to the bucket, and the bucket is 208.44 short."
      caption="The sale proceeds at the due date, split. The bucket's take is flat: it never earns more than the markup. The trader takes the whole upside and the whole downside, down to the down payment. Below that the bucket absorbs the gap, 200 of principal and no markup. Before the trader's profit share."
    >
      <g>
        <rect x={x0} y="22" width="14" height="10" className={styles.barMute} />
        <Text x={x0 + 20} y={31} anchor="start" lines="the bucket's take" className={styles.sub} />
        <rect x={x0 + 140} y="22" width="14" height="10" className={styles.barHatch} />
        <Text x={x0 + 160} y={31} anchor="start" lines="the trader's take" className={styles.sub} />
        <rect x={x0 + 280} y="22" width="14" height="10" className={styles.barShort} />
        <Text x={x0 + 300} y={31} anchor="start" lines="short of what is owed" className={styles.sub} />
      </g>
      <line x1={xOwed} y1="56" x2={xOwed} y2="280" className={styles.guide} />
      <Text x={xOwed} y={52} lines="owed to the bucket: 2,008.44" className={styles.labelMute} />
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
