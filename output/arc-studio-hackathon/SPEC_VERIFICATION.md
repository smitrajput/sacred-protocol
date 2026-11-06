# Specification arithmetic verification

Recomputed with Python Decimal/integer arithmetic on November 6,2026. This validates specification arithmetic, not Solidity or live integration behavior.

- P500,14days,10% annualized: markup1.917808; LP1.476712; manager0.441096.
- P10: markup0.038356; LP0.029534; manager0.008822.
- Full-range0.3%-fee AMM, total friction1%: reserve/input≥141.0042857; at 3%≥35.8181481. C20 needs≥716.362963USDC reserve at 3%, before margin.
- P10,M0.038356,coverage155%,f3%: gross sale reference value≈4.167763464USDC; worst-case proceeds≈4.042730560; principal remains≈5.957269440, above1USDC dust. Integer g rounds up to4.167764USDC before collateral-atom rounding.
- Formula with bps must multiply `(19000*D−10000*V)` by10000 before dividing by`19000*(10000−fBps)−100000000`. Omitting this factor undersells by about10,000×.
- Dust-limited lower band: policy P500/dust250/f1%≈145.67506394%; demo P10/dust1/f3%≈112.08236603%. The collateral-exhaustion bound 103.09278351% alone does not ensure1USDC principal remains.
- Initial coverage bound: `2*(1−f)/(1+0.10*14/365)≥1.9` ⇒ f≈463.5616bps maximum before token rounding; configured300bps, hard parameter cap460bps.

The build must verify these independent expectations through public contract entry points, plus conservation/fuzz tests and fork tests. The numerical examples are not substitutes for those checks.
