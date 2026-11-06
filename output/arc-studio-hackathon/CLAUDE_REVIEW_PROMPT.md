# Original Claude Fable review prompt

Historical review request retained for provenance. The v0.2 review is complete; current status and dispositions are in REVIEW_STATUS.json and REVIEW_DECISIONS.md. This is not an instruction to repeat the review before preflight.

Review the attached Sacred hackathon specification, PLANS.md and COMMIT_PLAN.md. This is the required review BEFORE implementation. Deadline: November 7, 2026 at 9:30 AM IST. Current build status: specification only; no new Studio implementation exists.

Goal: find the smallest set of changes that makes this design correct, implementable and demo-ready. Keep one cirBTC market and a complete sale-based financing lifecycle on Arc. Uniswap is core if its bounded feasibility check passes; bridge is optional; ENS is excluded. Preserve current Sacred mechanisms unless you identify a concrete contradiction, and distinguish deliberate pilot simplifications from accidental changes.

Review particularly:
- Purchase-before-sale custody and atomic rollback; gross temporary purchase liquidity versus net principal.
- Principal/markup/share/NAV accounting, rounding, late or early payment, zero NAV, last shareholder, FIFO partial fills and claim segregation.
- Impairment before withdrawals, reserve basis/order, limited recourse, bad debt and uncollected markup.
- 160% trigger / 190% restoration, actual execution friction, dust, stale feeds, excessive liquidation and testnet oracle assumptions.
- Missing contract/API interfaces or ambiguity that would force Studio to invent financial behavior.
- Real Uniswap and BridgeKit feasibility, testnet precision, backend hosting, Studio provenance, and bounded implementation scope.
- Minimal meaningful tests and small sequential commit boundaries. Use the organiser guidance if attached.

Return at most 10 material findings, ranked Blocker / Important / Optional. For each: ID, exact spec section, concrete failing scenario (numbers where useful), minimal proposed wording/change, required test and likely implementation cost. Separate source-confirmed facts from your judgment. End with: ready / ready after listed fixes / not ready, and the smallest viable cut if time is tight.

Do not write the implementation, add speculative features or rewrite the entire document. Do not count a mocked service as a verified integration. If you verify an external fact, provide its exact source and check scope. The output should be actionable review findings that Codex can incorporate in one focused revision pass.
