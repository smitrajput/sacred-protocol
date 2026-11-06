# Sequential implementation checkpoints

Canonical code repository: `smitrajput/sacred-markets`. Baseline before planning: `b5b8906`. Studio creates one checkpoint per turn; Codex downloads, checks, commits and pushes it locally before the next turn. See STUDIO_GIT_WORKFLOW.md. Ordinary checkpoints aim for 50–300 changed lines, including meaningful tests; split larger behaviors cleanly. Dependencies and generated output are separate. No 1,000-line catch-all commit.

| Prompt / checkpoint | Behavior / intended commit boundary |
| --- | --- |
| 00a | scaffold, pinned chain/token configuration and draft deployment manifest |
| 00b | pin v4 dependencies separately; adapter and tests separately; record seeded pool and two-way smoke results |
| 00c | minimal health endpoint and deploy configuration; verify chosen hosting access |
| 01a | NAV-priced deposits, mandate acceptance and funding/cap accounting |
| 01b | continuous FIFO reservations, dust/zeroNAV handling and claims |
| 01c | treasury seed, segregated protection buckets and loss order |
| 02a | independent demo feed, explicit refresh/scenario scripts and price checks |
| 02b | actual purchase → sale → pledge opening, atomic rollback and capacity checks |
| 02c | principal-first repayment, cumulative markup split and debt-free release |
| 02d | bounded partial sales, full close and maturity settlement |
| 02e | accounting/custody invariants and real testnet deployments |
| 03a | contract-backed read endpoints and bounded log pagination |
| 03b | keeper simulation, nonce/receipt handling, restart and manual fallback |
| 03c | Earn connect/deposit/request/claim user flow |
| 03d | Trade quote/open/repay/close and per-action transaction states |
| 03e | Activity, mobile/accessibility pass and deployed frontend/API reconciliation |
| 04a | complete real flow rehearsal and acceptance evidence; fixes remain separate commits |
| 05a | optional released cirBTC transfer and recovery, only after core green |
| 06a | architecture, provenance, runbook, integration evidence and submission materials |

Some checkpoints contain more than one inseparable tooling step; dependency changes still get their own commit. Ask Studio to stop at the first completed behavior within an oversized checkpoint. Commit messages describe outcomes. Tests use public interfaces and independent spec examples; fix reproductions precede fixes. Record actual validation and actor/trace in AI_WORKLOG.md, not invented success or ownership percentages.

Test seams from the accepted specification: vault public entry points (share/NAV/queue accounting); engine public entry points (custody, debt, loss and lifecycle); venue boundary on an Arc fork (real v4 settlement); API contract-read boundary; browser wallet flow against real testnet receipts. These are the agreed MVP verification boundaries, not a mandate to test every internal getter.
