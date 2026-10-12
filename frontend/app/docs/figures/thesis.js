import { Arrow, Figure, Text } from "./Figure";
import styles from "./figures.module.css";

// The thesis page's picture: four markets in a two-by-two, off chain against on chain and all of
// finance against Islamic finance, with the share each holds of its neighbour on the arrow
// between them. Red marks the two gaps Sacred is built to close.
//
// Figures: DeFi TVL and stablecoins from DefiLlama (October 2026); funds intermediated by the
// financial system from McKinsey (2025); Islamic finance assets from ICD-LSEG (2024); Muslim
// population share from Pew (2020 data). The Islamic DeFi number is the ceiling DefiLlama shows.

const BOX = { w: 220, h: 92 };
const COL = { left: 60, right: 480 };
const ROW = { top: 56, bottom: 246 };

function Market({ x, y, title, number, sub, accent }) {
  const cx = x + BOX.w / 2;
  return (
    <g>
      <rect x={x} y={y} width={BOX.w} height={BOX.h} rx="2" className={accent ? styles.accent : styles.paper} />
      <text x={cx} y={y + 24} textAnchor="middle" className={styles.title}>
        {title}
      </text>
      <text x={cx} y={y + 50} textAnchor="middle" className={accent ? styles.numBig : styles.big} style={{ fontSize: 20 }}>
        {number}
      </text>
      <Text x={cx} y={y + 70} lines={sub} className={styles.sub} />
    </g>
  );
}

export function Penetration() {
  const L = COL.left;
  const R = COL.right;
  const T = ROW.top;
  const B = ROW.bottom;
  const midY = (y) => y + BOX.h / 2;
  const midX = (x) => x + BOX.w / 2;
  return (
    <Figure
      w={760}
      h={352}
      min={640}
      label="Four markets in a grid. Finance, 468 trillion, has 0.02% on chain in DeFi, 93 billion. Islamic finance, 5.98 trillion, is 1.3% of finance and has 0.0008% on chain in Islamic DeFi, under 50 million. Islamic DeFi is 25 times further behind its parent than DeFi is, and 25 times short of the 1.2 billion that Islamic finance's share of DeFi would be."
      caption="How much of each market has moved on chain, and how far each sits from the one beside it. Red marks the two gaps Sacred is built to close: Islamic DeFi against its parent, and Islamic DeFi against DeFi. Sources: DefiLlama, October 2026; McKinsey, 2025; ICD-LSEG, 2024; Pew, 2020 data."
    >
      {/* Column heads */}
      <Text x={midX(L)} y={T - 22} lines="OFF CHAIN" className={styles.sub} />
      <Text x={midX(R)} y={T - 22} lines="ON CHAIN" className={styles.sub} />

      {/* The four markets */}
      <Market x={L} y={T} title="Finance" number="468 trillion" sub={["funds the world's financial", "system intermediates"]} />
      <Market x={R} y={T} title="DeFi" number="93 billion" sub={["total value locked, plus", "313 billion in stablecoins"]} />
      <Market x={L} y={B} title="Islamic finance" number="5.98 trillion" sub={["assets; 9.7 trillion", "projected by 2029"]} />
      <Market x={R} y={B} title="Islamic DeFi" number="under 50 million" sub={["across every halal", "protocol tracked"]} accent />

      {/* Across the top: how much of finance is on chain */}
      <Arrow
        points={[
          [L + BOX.w, midY(T)],
          [R, midY(T)],
        ]}
        label={["0.02% is on chain"]}
        at={[(L + BOX.w + R) / 2, midY(T) - 8]}
      />

      {/* Across the bottom: how much of Islamic finance is on chain */}
      <Arrow
        points={[
          [L + BOX.w, midY(B)],
          [R, midY(B)],
        ]}
        label={["0.0008% is on chain", "25× further behind"]}
        at={[(L + BOX.w + R) / 2, midY(B) - 20]}
        accent
      />

      {/* Down the left: Islamic finance's share of finance */}
      <Arrow
        points={[
          [midX(L), T + BOX.h],
          [midX(L), B],
        ]}
        label={["1.3% of finance, from", "26% of the people: 20× short"]}
        at={[midX(L), (T + BOX.h + B) / 2 - 2]}
        mute
      />

      {/* Down the right: Islamic DeFi's share of DeFi, against the share it ought to have */}
      <Arrow
        points={[
          [midX(R), T + BOX.h],
          [midX(R), B],
        ]}
        label={["0.05% of DeFi. At the 1.3% share", "it would be 1.2 billion: 25× short"]}
        at={[midX(R), (T + BOX.h + B) / 2 - 2]}
        accent
      />
    </Figure>
  );
}
