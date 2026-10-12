import { Arrow, Box, Figure, Text } from "./Figure";
import styles from "./figures.module.css";

// The architecture page's pictures: who calls whom, where every USDC goes, a position's states,
// and the order a shortfall is absorbed in. Function names are the contracts' own.

// ---- Who calls whom ----

export function Calls() {
  return (
    <Figure
      w={760}
      h={420}
      min={700}
      label="Depositors call the vault, traders call the desk, stakers call the staking fund, SCR buyers call the reserve sale, and a keeper or anyone calls cut-off on the vault and settle on the desk. The desk lends from and repays the vault, reads the oracle, swaps on the Uniswap v3 router and pays the profit share to the fund; the vault asks the fund for cover; the fund sells staked SCR in the Uniswap v4 pool. The frontend reads every view and sends every transaction through the wallet; the server runs the keeper, an indexer and a read-only API."
      caption="Who calls whom. Solid boxes are contracts on Arbitrum One; dashed ones run off chain. The frontend talks to every contract directly and asks the server for points only. Every exit works with the server switched off."
    >
      {/* People */}
      <Box x={10} y={10} w={90} h={40} title="Staker" />
      <Box x={155} y={10} w={100} h={40} title="Depositor" />
      <Box x={265} y={10} w={90} h={40} title="Keeper" sub="or anyone" />
      <Box x={365} y={10} w={100} h={40} title="Trader" />
      <Box x={665} y={10} w={90} h={40} title="SCR buyer" />

      {/* Contracts */}
      <Box x={150} y={120} w={110} h={60} title="Vault" sub={["shares, queues,", "the loss reserve"]} />
      <Box x={360} y={120} w={130} h={60} title="Desk" sub={["positions and", "the pledged assets"]} />
      <Box x={665} y={120} w={90} h={60} title="Reserve sale" sub={["SCR for USDC,", "delivered staked"]} />

      <Box x={150} y={250} w={110} h={60} title="Staking fund" sub={["USDC and", "staked SCR"]} />
      <Box x={382} y={250} w={80} h={60} title="Oracle" sub="Chainlink" />
      <Box x={500} y={250} w={100} h={60} title="Uniswap v3" sub="router" />
      <Box x={665} y={250} w={90} h={60} title="Reserve" sub={["deposits into a", "short bucket"]} />

      <Box x={150} y={350} w={110} h={50} title="SCR pool" sub="Uniswap v4" />

      {/* Off chain */}
      <Box x={300} y={350} w={190} h={50} kind="offchain" title="Frontend" sub={["reads every view, sends every", "transaction through the wallet"]} />
      <Box x={520} y={350} w={235} h={50} kind="offchain" title="Server" sub={["the keeper, an indexer, a read-only API;", "every exit works with it off"]} />

      {/* People to contracts */}
      <Arrow points={[[55, 50], [55, 280], [150, 280]]} label={["stake,", "unstake, claim"]} at={[61, 150]} anchor="start" />
      <Arrow points={[[205, 50], [205, 120]]} label={["deposit, withdraw,", "claim"]} at={[199, 86]} anchor="end" />
      <Arrow points={[[285, 50], [285, 100], [235, 100], [235, 120]]} label={["cut-off,", "weekly"]} at={[260, 82]} />
      <Arrow points={[[335, 50], [335, 100], [395, 100], [395, 120]]} label={["settle,", "after the due date"]} at={[365, 82]} />
      <Arrow points={[[415, 50], [415, 120]]} label={["open, close,", "pay off, part pay"]} at={[421, 86]} anchor="start" />
      <Arrow points={[[710, 50], [710, 120]]} label="buy" at={[716, 90]} anchor="start" />

      {/* Between contracts */}
      <Arrow points={[[360, 140], [260, 140]]} label={["lend, repay,", "write off"]} at={[310, 122]} />
      <Arrow points={[[260, 165], [360, 165]]} label="book value" at={[310, 178]} />
      <Arrow points={[[205, 180], [205, 250]]} label={["cover,", "on a shortfall"]} at={[211, 212]} anchor="start" />
      <Arrow points={[[370, 180], [370, 280], [260, 280]]} label={["10% of", "net profit"]} at={[315, 268]} />
      <Arrow points={[[422, 180], [422, 250]]} label="price" at={[428, 218]} anchor="start" />
      <Arrow points={[[475, 180], [475, 215], [550, 215], [550, 250]]} label="swap" at={[481, 200]} anchor="start" />
      <Arrow points={[[205, 310], [205, 350]]} label="sells staked SCR on a shortfall" at={[211, 334]} anchor="start" />
      <Arrow points={[[710, 180], [710, 250]]} label="USDC" at={[716, 218]} anchor="start" />

      {/* Off chain */}
      <Arrow points={[[490, 375], [520, 375]]} dashed label="points" at={[505, 414]} mute />
    </Figure>
  );
}

// ---- Where the money goes ----

export function Money() {
  return (
    <Figure
      w={760}
      h={380}
      min={700}
      label="A deposit enters the vault's idle cash at the cut-off. The vault lends the full cost to the desk, which buys the asset on the spot market and holds it pledged. The trader pays the down payment, part payments and pay-offs to the desk. When the asset is sold the desk returns principal and earned markup to the vault, pays 10 percent of any net profit to the backstop fund and the rest to the trader. The vault pays 10 percent of markup to the manager and moves 5 percent into its loss reserve, which covers shortfalls first; the fund covers them second and passes 30 percent of what it receives to the treasury. Withdrawals move idle cash to claimable at the cut-off, and the depositor claims it."
      caption="Every USDC in a bucket, and the path it takes. Solid arrows are the ordinary flow; dashed ones move only on a shortfall. The vault never reads its own balance: it counts idle cash, the reserve, queued deposits and claimable cash itself, so a donation cannot move the share price."
    >
      <Box x={10} y={60} w={90} h={44} title="Depositor" />

      <rect x={148} y={36} width={162} height={330} rx="2" className={styles.ghost} />
      <text x={300} y={50} textAnchor="end" className={styles.sub}>
        Vault, one bucket
      </text>
      <Box x={160} y={60} w={130} h={50} title="Idle cash" />
      <Box x={200} y={170} w={90} h={44} title="Loss reserve" />
      <Box x={160} y={300} w={130} h={44} title="Claimable" />

      <Box x={380} y={50} w={120} h={115} title="Desk" sub={["holds the", "pledged asset"]} />
      <Box x={610} y={50} w={110} h={40} title="Spot market" />
      <Box x={610} y={118} w={110} h={40} title="Trader" />
      <Box x={380} y={290} w={120} h={44} title="Backstop fund" />
      <Box x={610} y={290} w={110} h={44} title="Treasury" />

      <Arrow points={[[100, 82], [160, 82]]} label={["deposit, at", "the cut-off"]} at={[130, 62]} />
      <Arrow points={[[290, 75], [380, 75]]} label="lends the cost" at={[335, 68]} />
      <Arrow points={[[380, 97], [290, 97]]} label={["principal and", "earned markup"]} at={[335, 111]} />

      <Arrow points={[[500, 62], [610, 62]]} label="buys the asset" at={[555, 55]} />
      <Arrow points={[[610, 82], [500, 82]]} label="the asset, pledged" at={[555, 96]} />
      <Arrow points={[[610, 132], [500, 132]]} label={["down payment,", "part pay, pay off"]} at={[555, 112]} />
      <Arrow points={[[500, 150], [610, 150]]} label={["the surplus,", "less the profit share"]} at={[555, 164]} />

      <Arrow points={[[440, 165], [440, 290]]} label={["10% of a", "trader's net profit"]} at={[446, 230]} anchor="start" />
      <Arrow points={[[500, 312], [610, 312]]} label="30% of what it gets" at={[555, 305]} />
      <Arrow points={[[380, 320], [340, 320], [340, 250], [310, 250]]} dashed label={["covers a shortfall,", "after the reserve"]} at={[334, 274]} anchor="end" />

      <Arrow points={[[225, 110], [225, 170]]} label={["5% of", "markup"]} at={[219, 136]} anchor="end" />
      <Arrow points={[[265, 170], [265, 110]]} dashed label={["shortfalls,", "first"]} at={[271, 136]} anchor="start" />
      <Arrow points={[[175, 110], [175, 300]]} label={["withdrawals,", "at the cut-off"]} at={[181, 250]} anchor="start" />
      <Arrow points={[[160, 322], [55, 322], [55, 104]]} label="claim" at={[61, 200]} anchor="start" />
    </Figure>
  );
}

// ---- Life of a position ----

const states = [
  { y: 30, fn: "close", title: "Closed", sub: ["by the trader, any time;", "the asset sold, the surplus paid"] },
  { y: 84, fn: "payOff", title: "Paid off", sub: ["by the trader, any time;", "the asset released to the trader"] },
  { y: 138, fn: "settle", title: "Settled", sub: ["by anyone, after the due date;", "the asset sold, the surplus credited"] },
  { y: 192, fn: "settle, short", title: "Settled short", sub: ["the sale fell below the balance;", "the bucket absorbs the gap"] },
];

export function Lifecycle() {
  return (
    <Figure
      w={660}
      h={230}
      label="A position is opened and is live. Part payments keep it live with a lower balance. It ends closed, paid off, settled, or settled short, and no state follows those."
      caption="A position's states. Four are final and nothing follows them; a position cannot be reopened, extended or re-priced. Only the trader can move a live position before the due date."
    >
      <circle cx={16} cy={120} r="4" className={styles.head} />
      <Arrow points={[[20, 120], [50, 120]]} label="open" at={[35, 112]} />
      <Box x={50} y={88} w={140} h={64} title="Live" sub={["the asset pledged,", "a balance owed"]} />
      <Arrow d="M150 88 C150 44 90 44 90 88" label="partPay: the balance falls" at={[120, 40]} />
      {states.map((s) => (
        <g key={s.title}>
          <Arrow points={[[190, 120], [300, 120], [300, s.y], [420, s.y]]} label={s.fn} at={[360, s.y - 6]} />
          <Box x={420} y={s.y - 23} w={225} h={46} title={s.title} sub={s.sub} />
        </g>
      ))}
    </Figure>
  );
}

// ---- The order a shortfall is absorbed in ----

const layers = [
  ["The trader's down payment", "it is inside the asset's value"],
  ["The bucket's loss reserve", "5% of every markup, up to 3% of the bucket"],
  ["The backstop fund's USDC", "fed by 10% of traders' net profit; holds 8% of the financed amount"],
  ["Staked SCR, sold in the pool", "at most 30% of the stake, 10% under the average"],
  ["The bucket's depositors", "in proportion, through the share price"],
];

export function LossOrder() {
  return (
    <Figure
      w={620}
      h={250}
      min={520}
      label="A shortfall is absorbed in order by the trader's down payment, the bucket's loss reserve, the backstop fund's USDC, staked SCR sold in the pool, and finally the bucket's depositors through the share price."
      caption="When a pledged asset sells for less than the balance, the gap falls through these layers in order. No other bucket is touched, and a depositor who leaves gives up any claim on the reserve."
    >
      <Text x={10} y={26} anchor="start" lines="A shortfall" className={styles.big} />
      <Text x={10} y={44} anchor="start" lines={["what one layer", "cannot cover", "falls to the next"]} className={styles.sub} />
      <Arrow points={[[100, 14], [100, 236]]} />
      {layers.map(([name, note], i) => {
        const y = 14 + i * 46;
        const last = i === layers.length - 1;
        return (
          <g key={name}>
            <rect x={130} y={y} width={470} height={38} rx="2" className={last ? styles.accent : styles.paper} />
            <text x={146} y={y + 23} className={styles.num}>
              {i + 1}
            </text>
            <text x={162} y={y + 23} className={styles.title}>
              {name}
            </text>
            <Text x={588} y={y + 23} anchor="end" lines={note} className={styles.sub} />
          </g>
        );
      })}
    </Figure>
  );
}
