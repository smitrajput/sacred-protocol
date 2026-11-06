> Historical research snapshot. The revised implementation decisions and current checks are in [spec v0.3](../../output/arc-studio-hackathon/spec.md) and [review dispositions](../../output/arc-studio-hackathon/REVIEW_DECISIONS.md).

# Sacred protocol and implementable pilot specification

## What the current protocol actually requires

### Takeaway
Build Earn plus Trade only: one real spot asset, USDC, 2x leverage, fixed sale, pledge, repayment, partial sale, and a persistent withdrawal queue. The latest public design is materially different from the contracts already in this repository.

### Cited Findings
- Live pages were retrieved successfully with public HTTPS requests on Nov 5/6 2026. Their text matches the local frontend documentation. Sacred says the parameters are research parameters as of Nov 2 2026, proposed, not deployed on Arc, audited, or Shariah approved. [Overview](https://sacred.markets/docs)
- At 2x, financing is 50% of asset purchase cost; term is 14 days; quoted annualized markup is 10% of financing, ACT/365. Full markup is fixed and booked once at origination. No late penalty, no rollover, no mandatory share of trader profit. [Trade mechanics](https://sacred.markets/docs/trade/mechanism)
- Opening order in one transaction: quote and checks; reserve temporary purchase cash equal to 2x financing; vault actually buys and owns spot asset; vault sells at disclosed cost plus fixed markup; trader pays their initial contribution; asset remains pledged. The vault must possess the asset before resale. [Trade mechanics](https://sacred.markets/docs/trade/mechanism)
- Coverage is asset value divided by **full remaining debt, including remaining markup**, not principal alone. At 2x, trigger partial sale at 160%, restore to 190%; financing dust below $250 closes. [Trade mechanics](https://sacred.markets/docs/trade/mechanism)
- All repayments and sales apply cash to principal first, then markup, then trader surplus. Recourse stops at the pledge; shortfall is recorded even if reserves cover it. Impairments precede distributions, share minting, and redemptions. [Trade mechanics](https://sacred.markets/docs/trade/mechanism)
- Collected base markup splits 77% to depositors and 23% manager; manager cash pays actual essential operations once, then primary protection, tail protection, 12 months company operating cash, then distributions. Depositor principal is never protection. Primary target is 0.4% and tail target 0.6% of approved financing, separately checked. [Economics](https://sacred.markets/docs/earn/economics)
- Loss order: trader equity already in collateral; primary reserve; tail reserve; separate pilot backstop; residual depositor loss. Each vault isolated. Existing vintages retain agreed income shares; conservation terms are new vintages only. Withdrawals consume idle cash then remain in a persistent daily queue, ahead of new financing. Originations stop at a 5% idle floor and approved financing including commitments cannot exceed 95% NAV. [Earn](https://sacred.markets/docs/earn)
- SIFT pilot is illustrative $50,000 NAV, $25,000 total financing ceiling, $500 per account; $500 also equals 1% NAV. Full SIFT is a substantial onchain ledger, daily capacity, 52-week statistics, deterministic allocation and repayment-checkpoint system. It is not necessary to claim the pilot's fixed account limit. [SIFT](https://sacred.markets/docs/trade/sift)
- Arc proposed architecture names mainnet chain 5042, but the hackathon must choose and explicitly label its testnet deployment. Debt is six-decimal ERC20 USDC; native gas USDC uses 18 decimals for the same balance and must not be added a second time. Price sources remain unselected, production needs two independent sources fresh within 60s; Arc depth is unmeasured. [Architecture](https://sacred.markets/docs/architecture)
- Ownership within one transaction, crypto eligibility, pledges, forced sales, rebates, limited recourse, and manager-funded protection remain open Shariah review questions. Prototype wording should say proposed sale-based financing, testnet demo. [Shariah](https://sacred.markets/docs/shariah)
- Repo README explicitly says its Solidity is older term mode: 30% trader-profit share, all markup to depositors, weekly queues, no forced pre-maturity sale. Do not ask Studio to import those mechanics as current Sacred. [Contracts and code](https://sacred.markets/docs/contracts)

### Inferences
- Recommended scope: one fixed 77/23 subscription cohort, one asset, only 2x, static $500/account and $25k pilot caps, <=32 live positions, <=64 withdrawal requests. No Borrow, SCR token, higher tiers, full SIFT, conservation vintages, embedded wallets or cross-product subsidies. This preserves the core economics while dropping the largest implementation risks.
- A fixed-cohort pilot can accept deposits only during an initial funding phase and then permanently close subscriptions before the first position. This eliminates late-deposit profit entitlement ambiguity and reduces dilution complexity. Alternatively allow later deposits at current principal-based NAV with explicit cohort entitlement rules; the fixed cohort is the simpler deadline choice.
- Use the authentic supported cirBTC token and a canonical Uniswap deployment if integration research verifies availability. Otherwise one clearly labeled test asset. Token symbols or mock routers do not establish a working protocol integration.

### Gaps
- Public docs do not completely specify share minting/redemption algorithms, partial-fill queue rounding, early rebate policy for Trade, protection contracts, oracle providers, or route sizes. The following are proposed implementation choices, not published Sacred policy.

## Exact contract design and arithmetic

### Takeaway
Two principal contracts plus small adapters suffice: MarginVault owns depositor cash, nontransferable shares and queue; TradeEngine owns the pledged-position book and invokes real spot trades. Use immutable, narrowly scoped addresses and actual balance deltas.

### Inferences

#### Contracts
- `MarginVault`: six-decimal USDC; nontransferable internal shares; initial cohort terms fixed 7700 bps; idle depositor cash; outstanding principal; explicit manager-payable and three protection balances; FIFO request IDs; claimable withdrawals; onlyEngine lending/collection/writeoff entry points. A single-ledger contract may segregate these balances if every function enforces the segregation. Separate protection escrow is cleaner but optional.
- `TradeEngine`: immutable Vault, asset, oracle guard and route adapter. Position: trader, original asset cost, original financing, remaining principal, original/remaining markup, quantity pledged, openedAt, maturity, status, termsHash. Max 32 live IDs; nontransferable positions. `open`, `repay`, `repayAndRelease`, `close`, `rebalance`, `settleMatured`, `getPosition`, `previewOpen`, `previewRebalance`. Repayment is never disabled by an origination pause or stale oracle.
- `SpotAdapter`: exact supported USDC/asset route only, exact-input swaps, no arbitrary target/calldata, verified real pool/router. Actual token balance deltas determine spend/output. Reset approvals or use bounded approvals. Set minOut and deadline; no zero-minOut keeper transactions.
- `PriceGuard`: production-shaped interface; checks timestamp, positivity, scales, configured deviation and source agreement. A controlled demo feed is acceptable only on testnet and labeled; it is not a production oracle. Never use the same small AMM's instantaneous spot as sole security oracle.
- Prefer immutable policy parameters and addresses for this demo. Guardian can pause new deposits/originations only. Admin cannot withdraw collateral, alter existing debt or maturity, take LP cash, or set keeper-chosen prices.

#### Open and ownership
1. Check caller, fresh quote, caps, route, oracle, queue emptiness, minimum amount and fresh contribution allowance. Reserve account and portfolio commitments before external calls, under reentrancy protection.
2. For contribution E at 2x: `C=2E`, `P=C-E=E`. Vault needs **C**, not P, of free depositor USDC. Check post-contribution net idle cash and principal caps too.
3. Vault spends C USDC on real spot purchase; asset arrives in Vault (or a narrowly authorized agent explicitly holding for Vault). Verify asset balance increase q. Record/emit actual acquisition with Vault ownership.
4. Transfer acquired asset into Engine custody; record sale to trader with C disclosed and markup M fixed, and transfer contribution E from trader to Vault. Atomically record beneficial ownership by trader and the pledge. The transaction reverts in full if contribution or sale cannot complete. Do not merely mint an NFT receipt without a real asset purchase.
5. Cash ends down by P; outstanding principal rises P; LP NAV unchanged. Pledged asset must never be counted again in LP NAV as well as its receivable.

`M = floor(P * 1000 * termSeconds / (10000 * 365 days))`, using full-precision mulDiv. 1000 bps is 10% APR on financing, not on gross purchase cost. `D=P+M`. Round markup once at origination. `maturity=openedAt+termSeconds`. There is no continuing accrual, compounding or late penalty. For the MVP Trade rebate is zero and disclosed up front; do not invent a mandatory early rebate. Repaying early therefore pays the fixed remaining sale price.

#### Payments, closing and losses
For any cash receipt S: `pPaid=min(P,S)`; `mPaid=min(M,max(0,S-P))`; `surplus=max(0,S-P-M)`. Decrement balances once; only actually received markup is allocated. Principal remains until cash returns or a finalized writeoff occurs. An ordinary partial repayment does not create a shortfall; the shortfall formula applies only when the pledged position is finally closed.

For a final close after actual swap costs: `shortfall=P_before-pPaid`; record this gross economic loss, then consume primary, tail, pilot-backstop cash in order, then residual LP loss. Reserve recovery is not markup or trader repayment. Clear all remaining debt on final limited-recourse closure; a remaining unpaid-markup amount is written off and never capitalized or pursued externally. Return all excess USDC to trader. On full wallet repayment transfer remaining pledged asset to trader; bridging can begin only after this release and cannot make repayment depend on crosschain success.

Split markup cumulatively per position to avoid payment-splitting rounding attacks: `lpDue=floor(cumulativeMarkupCollected*7700/10000)-lpAlreadyAllocated`; manager receives `mPaid-lpDue`. Never split principal or collateral-sale surplus. With zero operational expense in the demo, retain the entire manager share in protection cash until primary then tail targets are met; label expense budgeting and company distributions deferred. If exact cash waterfall is implemented, only funded actual expense budgets may be paid, never arbitrary manager withdrawal. Seed protection using separately identified test treasury contributions; it is not yield and not depositor capital.

#### Partial sale
Use current `V=oracleValue(q)` and remaining full `D=P+M`. Trigger when `V*10000 <= D*16000`. For restore `R=1.9` and no sale friction, solve `(V-x)/(D-x)=R`: `x=(R*D-V)/(R-1)` USDC of asset value to sell. Round required asset quantity UP, cap at available quantity, execute actual market swap, and apply actual cash principal first.

With worst-case variable sale friction f, conservative gross asset value needed is `g=(R*D-V)/(R*(1-f)-1)`, provided denominator is positive. Net cash is `(1-f)*g`. An implementation can use a bounded quote to solve the same condition rather than fixed f. Check **actual** post-sale coverage against 190%, with a narrowly documented integer rounding tolerance. If target cannot be reached, debt is zero, or remaining principal would be below $250, close the whole position. Do not pay a keeper fee out of LP principal in this MVP; keepers use separately funded gas.

`close` is owner-authorized at any time. `rebalance` is permissionless only at the coverage trigger. `settleMatured` is permissionless only at/after immutable maturity and closes all remaining collateral if debt remains. Each sale still needs fresh guarded price, real minimum proceeds and deadline; failure leaves position live, reports retry reason, and never fabricates settlement.

#### NAV and shares
`LP_NAV = depositorIdleCash + outstandingPrincipal` after required impairment resolution. Exclude uncollected markup, manager balance, reserves, trader surplus liabilities and already reserved withdrawal claims. Contractual markup is booked in the debt ledger, not immediately credited as distributable LP earnings. Collected LP markup increases depositorIdleCash and share value. A finalized residual principal writeoff decreases outstandingPrincipal without cash, hence NAV falls.

Do not allow mint/redemption/manager distributions against known impaired face-value principal. Lean solution with <=32 live positions: scan fresh guarded valuations first; if conservative net collateral value is below remaining principal, revert `AccountingNeedsSettlement(id)` until that position is settled and its impairment processed. This avoids complex provisional impairment/recovery accounting. If stale, block price-sensitive capital operations; repayment and debt-free release still work. A deeper production implementation would recognize impairments without requiring liquidation; that is outside the MVP.

If subscriptions stay open: `sharesMinted=floor(deposit*totalShares/NAV_before)` with checked zero-NAV cases; first deposit uses 1 share unit per USDC unit; reject zero-share deposits. Direct token donations must not silently mint shares or change accounting. For easier correctness, close subscriptions permanently before origination and use one initial cohort.

Withdrawal requests lock shares; they remain in total supply and participate in gains/losses until actually redeemed. Global FIFO, no per-user bypass. Process head first with `maxRequests<=16`, partial fills allowed; unfilled shares remain at head. Burn filled shares at current NAV, reserve USDC as claimable, and immediately exclude the reserved cash from LP NAV; claim transfer must not change NAV a second time. Use floor assets for given shares and ensure any partial-fill computation cannot burn shares for zero cash. Claims use pull payments. Requests cannot be cancelled/reordered for priority advantage in this demo. Process daily epochs for the queued path; immediate idle redemption may use the same head processor. All new openings revert while any older unfilled withdrawal exists. This stronger queue rule is a deliberate simple implementation of withdrawal priority.

#### Numeric vectors
- Published scale, pure math test: P=5,000.000000, 14 days, 10% gives M=19.178082, D=5,019.178082. Full collected markup gives LP 14.767123 and manager 4.410959. A $11,000 net close pays P 5,000, M 19.178082 and trader 5,980.821918. These are reference vectors; the demo account cap is $500.
- Live pilot scale: E=500, C=1,000, P=500. At 14 days M=1.917808, D=501.917808, LP=1.476712 and manager=0.441096. With NAV 50,000 and cash 50,000, after open cash=49,500 and principal=500, so NAV remains 50,000. Test minOut and actual q independently of these debt values.
- At the 160% trigger for the published scale, V=8,030.6849312. No-friction gross sale x=1,673.0593606667; remaining asset value=6,357.6255705333 and debt=3,346.1187213333, exactly 190%. With 0.5% exit friction, gross required=1,690.9078322291 and net recovery=1,682.4532930679. Use rounded-up asset units and cross-multiplied integer assertions.
- Final shortfall fixture: P=5,000, M=19.178082, net S=4,800 -> gross principal loss=200, collected markup=0, surplus=0. Primary40, tail60, pilot50 cover150; LP NAV loses50. Record economic loss200 even though LP loses50.
- FIFO fixture: Alice initially deposits30,000 and Bob20,000 (NAV50,000). Open P500, leaving49,500 cash. Alice requests all30,000 shares and is paid first. Bob requests20,000:19,500 can be reserved,500 shares remain queued. New financing blocked. Full debt repayment adds500 principal +1.476712 LP income to the remaining NAV; Bob's final500 shares redeem501.476712. Manager0.441096 remains excluded. Claims must not double-decrement NAV. This illustrates remaining queued shares bearing outcomes; document initial-cohort economics clearly.

### Gaps
- 14 days cannot elapse during a 32-hour hackathon. Keep the economic deployment at14 days and use deterministic time-warp unit tests for maturity. If a live maturity demo is needed, deploy a separate visibly labeled immutable10-minute demo instance with the same annual APR and displayed smaller markup; never mutate a live sale's maturity or silently present test time as14 days.
- A testnet price scenario must also produce a real consistent AMM execution price. Merely lowering a feed while the actual pool stays at the old price does not demonstrate a faithful partial liquidation. Seed a separate scenario pool and move its price through actual swaps, update disclosed demo feeds consistently, then run the actual keeper.

## Frontend backend and acceptance

### Takeaway
One responsive app with Earn, Trade and Activity, plus a real minimal read API and keeper. The contracts remain the source of financial authority.

### Inferences
- Earn: connected account USDC balance; deposit during funding phase; fixed77/23 mandate acceptance; principal/share value, collected earnings and reserves separately; withdraw amount; queue position, unfilled shares and claimable USDC. No guaranteed APY display.
- Trade: one asset; contribution; fixed2x; real quoted purchase quantity; financing; fixed markup/debt; actual maturity; coverage trigger/restoration; slippage and network; approve/open. Positions show collateral quantity, full debt, coverage, status and transaction links. Buttons repay amount, repay and receive asset, sell and close. Bridge button only for released assets, in a distinct operation with retry/status.
- Activity: chronological onchain events: acquired, sold/pledged, payment, principal/markup allocation, rebalance, reserve draw, writeoff and queue fill. Show real hashes and actual receipts. A compact architecture diagram and deployed addresses are available to judges.
- Minimal backend: Node/TypeScript server using viem; `/health`, `/config`, `/vault`, `/positions?owner=`, `/activity?cursor=`. Read contract state directly; small SQLite/file-backed event cache is optional and never financial authority. Return block number and timestamp. Decimal amounts as integer strings, never JS floats for transactions. Config includes chain ID, verified addresses, deployment block and policy hash.
- Keeper: every10-15 seconds poll bounded live IDs, simulate trigger/maturity calls, submit only eligible actions, await receipts, track tx/nonce, persist last processed block, idempotently retry. Then process eligible withdrawal queue batches. Key holds gas only, has no admin privilege; never exposed to client. UI displays last successful poll and failures. Manual permissionless fallback buttons call the same methods.
- Required tests: acquisition-before-sale and full revert on swap/contribution failure; fixed markup and no late growth; principal-first partial/full payments; cumulative77/23; coverage uses markup; conservative partial-sale math and dust close; real Uniswap integration swaps; pool manipulation versus oracle guard; stale/deviating feed gates; slippage failure preserves state; caps include pending commitments; queue FIFO/partial persistence and no origination leapfrog; claim accounting once; fresh loss before redemption; reserve order and economic loss preserved; collateral cannot be reused/taken; unauthorized/duplicate settlement fails; reentrancy and decimals8/6/18; pause keeps repay/release working.
- End-to-end evidence: two wallets seed/deposit and open a real swap-backed position; repay and release; second position undergoes real partial sale; LP collected markup and manager split reconcile; queued withdrawal fills from repayment; explorer links all resolve. Maturity shown via tested time-warp or clearly labeled short-term deployment. Do not make all this depend on a bridge succeeding.

### Cited Findings
- These recommendations implement the current priority, ownership, limited-recourse, fixed-term and safety constraints. [Trade mechanics](https://sacred.markets/docs/trade/mechanism), [Architecture](https://sacred.markets/docs/architecture), [Earn](https://sacred.markets/docs/earn).

### Gaps
- Backend host/process availability and Arc Studio ability to deploy persistent workers must be established in the tool preflight. If no persistent worker exists, supply the real read API and a user-triggered permissionless keeper action; label autonomous scheduling unavailable rather than pretending a timer is hosted.
