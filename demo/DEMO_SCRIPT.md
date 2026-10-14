# Sacred demo: depositor and trader on a MON bucket

The app as it ships, running on a simulated chain in the browser. No wallet extension, no node,
no server. The Vault and the Desk are simulated function by function from `contracts/src`, with
the app's own arithmetic (`lib/math.js`), so every figure on screen is what the contracts would
record. Prices and the clock move only when you press a presenter button, so every take shows
the same numbers. `npm run rehearse` replays this script and prints each figure.

## Before you record

- Open the link. Press the **backtick key** (`` ` ``) to open the presenter panel, bottom right;
  press it again to hide it. Keep it hidden on camera and open it only to move price or time.
- **Reset demo** in the panel, or reload the page, starts again from the top.
- **Hide demo badge** in the panel removes "Demo, simulated chain" from the bar. If you hide it,
  say it is a simulation in the narration.
- Today on the simulated chain is the day you record, at 12:00 UTC. The next weekly cut-off is
  three days later. Dates below are relative to that.
- Each action takes about a second to confirm, like a wallet confirmation and a block.

## The script

The figures below are exact. Default inputs in the order form are already 1,000 USDC, 2x and
14 days.

### 1. The bucket (depositor)

| Do | You see |
| --- | --- |
| Open the page | Earn: **200,159.41 USDC** in the bucket, **74.94%** financed, share price **1.000797** |
| **Connect wallet** | Bar: `25,000.00 USDC · 0.00 MON` |
| Deposit, USDC: `10000`, **Request deposit** | Two confirmations (approval, then the deposit). *Queued deposit: 10,000.00 USDC* |
| Presenter: **Run weekly cut-off** | Date jumps 3 days. Share price **1.002390** (a week of markup), in the bucket **210,159.41** |
| **Claim shares** | Your shares **9,976.16** |

Say: deposits wait for the weekly cut-off, so nobody can jump in front of known gains. Yield is
the markup traders pay, nothing else.

### 2. A position that ends in profit (trader)

| Do | You see |
| --- | --- |
| Look at the order form | The vault buys MON for **2,000.00**, that is **80,000 MON**. Markup **5.95**, fixed once at 15.5% a year. You owe in 14 days **1,005.95** |
| **Open position** | Two confirmations. *Position 7*, 80,000 MON pledged |
| Presenter: **+30%** | Position 7: to settle today **1,000.42**, worth now **2,600.00**, you would get **1,539.62** |
| **Close** on position 7 | *1,539.62 USDC to your wallet, 59.96 to the backstop fund*. Bar: **15,539.62 USDC** |

Say: the markup was fixed when the position opened and never grows. Leaving early costs only the
days used (1,000.42 today, not 1,005.95). 10% of net profit goes to the backstop fund.

### 3. Part pay, then pay off and take the coin (trader)

| Do | You see |
| --- | --- |
| Presenter: **Start**. Term: **7 days**. **Open position** | Owe in 7 days **1,002.97**. *Position 8* |
| Presenter: **+1 day**, then **+10%** | Position 8: to settle today **1,000.42**, worth now **2,200.00** |
| Type `400` next to position 8, **Part pay** | To settle today drops to **600.42** |
| **Pay off** on position 8 | *Paid off with 620.38 USDC: 80,000.00 MON to your wallet*. Bar: `13,519.24 USDC · 80,000.00 MON` |

Say: paying off hands over the real coin. The 620.38 is the 600.42 balance plus the 10% profit
share, priced from the feed, so paying off cannot dodge it.

### 4. A crash that liquidates nobody (trader)

| Do | You see |
| --- | --- |
| Presenter: **Start**. Term: **14 days**. **Open position** | *Position 9*, 80,000 MON |
| Presenter: type `0.0120`, **Set** (MON down 52%) | Position 9: worth now **960.00**, you would get **under water**. The Close button is off |

Say: at 2x, a 52% fall would liquidate this position on any lending market. Here nothing
happens: no margin call, no liquidation. The position waits for its due date.

Then pick an ending.

**4a. MON recovers (main ending)**

| Do | You see |
| --- | --- |
| Presenter: **+15 days**, type `0.0300`, **Set**, then **Settle due positions** | *Position 9 settled: 1,353.75 USDC waiting for its owner*, and the keeper settles the other traders' positions |
| **Collect** | Bar: **13,872.98 USDC** |

Say: the trader who would have been liquidated walks away with 1,353.75 for a 1,000 down payment.

**4b. MON stays down**

| Do | You see |
| --- | --- |
| Presenter: **+15 days** (price still 0.0120), **Settle due positions** | *Position 9 settled short: 41.00 USDC written off against the loss reserve and the backstop fund; the trader owes nothing* |

Say: the trader loses the down payment and never more. The loss reserve and the backstop fund
take the gap before depositors do.

### 5. The depositor leaves with the yield

| Do | You see |
| --- | --- |
| Withdraw, shares: `9976.15`, **Request withdrawal** | *Queued withdrawal: 9,976.15 shares* |
| Presenter: **Run weekly cut-off** | Share price **1.004087** after ending 4a |
| **Claim USDC** | *10,016.92 USDC to your wallet*: 10,000 in, 10,016.92 out over 16 days |

Type `9976.15`, not the displayed 9,976.16: the holding is 9,976.157, which the panel rounds up.

## Why this is not recorded on Monad testnet

The contracts are deployed and verified on Monad testnet (addresses on
[sacred.markets/docs/contracts](https://sacred.markets/docs/contracts)), but a live demo there
cannot show this script:

1. **No markets.** Monad testnet has no USDC, WBTC, WETH or Uniswap v3, so the deployment trades
   against mock tokens and a mock router that mints at a set price. Nothing is really bought.
2. **No moving prices.** There are no Chainlink feeds; the deployed feeds are mocks that change
   only when someone sends a transaction to set them.
3. **No fast-forward.** Terms are 7 or 14 days and settlement opens only after the due date. A
   public chain cannot skip time, so the crash-and-settle story would take two weeks.
4. **Weekly cut-off.** Deposits and withdrawals are processed once a week (the first testnet
   cut-off is 20 Oct), so a deposit-to-yield round trip takes weeks.
5. **Allow-lists.** The deployed desk and vault accept approved wallets only; each demo wallet
   needs an approval transaction from the owner first.
6. **The app is not wired to Monad**, and settlement and the cut-off need the server's keeper.
7. **Wallet friction.** Faucet MON, and a wallet pop-up and confirmation wait for every action.

## What the demo simulates, and what differs

- Simulated: the chain itself (balances, approvals, the vault's queues and cut-off, the desk's
  positions, settlement, the loss reserve, the backstop fund's cover), the price feed and a
  market that fills at the feed price with no slippage.
- The economics are the launch dials the app and docs show: 15.5% a year markup and 10% of net
  profit to the backstop fund. The contracts deployed on Arbitrum One and Monad testnet still
  carry the first design's dials (10% plus 1% above 2x, and a 30% profit share).
- MON's ceiling is 2x here, as for ETH. The demo bucket starts with 200,000 USDC from other
  depositors and four live positions from other traders, built through the same functions.
