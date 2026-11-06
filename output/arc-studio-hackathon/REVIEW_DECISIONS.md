# Fable review dispositions — v0.3

Claude Fable reviewed v0.2 on November 6, 2026. This is Codex's technical summary and disposition, not a verbatim review transcript. The user's original review remains in the local planning workspace. No application implementation or deployment is claimed here.

| ID | Disposition and change | Evidence / implementation check |
| --- | --- | --- |
| F1 | Accept existing v4 deployment; remove v2 and alternate live venue. Qualify provenance separately from code presence. | RPC block 71009777: six contracts have code, three PoolManager getters agree, EURC pool liquidity 151438096. CirBTC pool remains uninitialized. Require identity verification and fork/live swaps in preflight. |
| F2 | Accept 300-bps demo bound and smaller amounts; correct funding requirement. E10 is preferred, not mandatory. Scale E/ceiling/cap/dust together; first fallback E0.10. | Exact full-range bound is141.0043× input at 1%,35.8182× at 3%. C20 still needs716.37 USDC per side; C0.20 needs7.17. Quotes and live balances decide size. |
| F3 | Accept liveness problem; choose independent admin demo fixture, age 24h plus an assigned daily refresh script/runbook. Reject pool spot as liquidation oracle. | Same-pool spot is manipulable within a transaction; guard bands and pre-sale capture do not remove that dependency. Test expiry, invalid/future timestamps and stale-feed repayment/claims. |
| F4 | Accept Netlify frontend, single-process API/keeper, explicit gas floor. Add HF account/sleep check and Netlify Functions + operator keeper fallback. | Arc docs confirm20gwei floor; live gasPrice 20 gwei. HF docs require paid entitlement for new Docker Spaces and describe sleeping hardware. Prove actual deployed API and keeper receipt. |
| F5 | Accept sacred-markets repository and contracts/src/api/docs layout. | Existing local checkout has origin git@github.com:smitrajput/sacred-markets.git and baseline b5b8906. Preserve prior sacred repository separately. |
| F6 | Accept local Git ownership and shorter prompts. One checkpoint per Studio turn. Do not depend on a studio-export branch control that is undocumented. | CLI supports --app, --out, --changed, --dry-run, --diff; exit 2 skips local edits. First full pull and explicit local commits/pushes. |
| F7 | Accept open NAV deposits with queue-empty and impairment gates, minShares and explicit exclusion of uncollected markup. | Test post-open deposit, zero shares, positive-NAV dilution, zero-NAV rejection and later realized markup allocation. |
| F8 | Accept dust/zero-NAV liveness fix, with narrower write-off rule. Burn entire residual only if its whole redeemable value is0 and request accepted dust terms. | A partial payout rounding to0 must not burn a valuable request. Test dust head advances, insufficient liquidity waits, zeroNAV and unlocked worthless-share burn/reset. |
| F9 | Accept explicit feasibility band; correct the proposed integer formula and demo lower bound. | Numerator needs ×10000. With P10/dust1/f3%, lower coverage≈112.0824%, not103%; policy P500/dust250/f1%≈145.6751%. Rehearse155%; policy140% closes fully. |
| F10 | Accept immutable ceiling-based targets and explicit treasury seed function. Keep primary→tail→backstop→LP. | Ceiling100 gives0.4/0.6USDC targets; loss-vector ceiling1000 gives4/6. Test actual token transfers and no share mint/NAV increase. |
| F11 | Accept tighter scope and revised time gates; no optional bridge until core passes. | Core21:00; app/rehearsal 00:30; optional cutoff01:30; freeze 02:00; video 04:00; submission07:30 before09:30 AM. |
| M1 | Adopt ≤4-minute unsped video based on Fable's form inspection. | Confirm upload acceptance while preparing submission; retain4-minute finalist demo/3-minute Q&A. |
| M2 | Keep integration file/line documentation and reusable interfaces. Defer extracting separate libraries/contracts. | Avoid another contract boundary during MVP; implementation README documents real interfaces and integrations. |
| M3 | Accept Arc runtime cautions that affect this build. | ERC20 balance accounting only; explicit gas floor; no native-value/selfdestruct routes. |
| M4 | Accept removal of onchain previewOpen. | UI computes terms with bigint and gets executable venue quote through Quoter simulation. |
| M5 | Accept continuous FIFO, remove epoch language. | Priority persists across calls and repayments. |
| M6 | Remove Eco Sauce from Studio setup. | Direct v4 execution is the selected integration. |
| M7 | Remove reliance on undocumented attachment caps; retain confirmed 10,000-character prompt cap. | Check every distributed prompt length. |
| M8 | Accept explicit repayment callers and recipient ownership. | Third-party payer can repay; released collateral/surplus always go to trader. |
| M9 | Keep acquisition order and temporary2P cash requirement. | Failed swap/contribution rolls back; actual acquisition precedes sale/pledge events. |
| M10 | Keep real chronology and preserve baseline. | Planning/revision commits have actual timestamps and observed AI attribution. |

Smallest-cut amendment: merging three protection buckets is rejected because their loss order is part of the chosen Sacred design; three counters are not the main delivery bottleneck. Pool-spot solvency pricing is rejected for the reason above. Open deposits, continuous FIFO, one service, no previewOpen, optional bridging and small live amounts are adopted.

Remaining preflight work: role wallets and token funding; upstream contract identity; pool seeding and bidirectional transactions; Studio app ID/login; hosting access; real live demo scale. These are operational checks, not claims already verified. `ARC_V4_READ_CHECK.json` records the read-only chain evidence. `SPEC_VERIFICATION.md` records independently recomputed math. Implementation commit SHAs will be recorded in AI_WORKLOG.md as work occurs.

Additional Codex consistency fix: retain at least one share while any position remains live. Otherwise a principal-only repayment plus last-share redemption can orphan later markup. Require a public-entry-point regression test for P=0/M>0 → withdrawal → final markup settlement → final claim.
