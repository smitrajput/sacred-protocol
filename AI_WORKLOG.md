# Sacred AI work log

This log distinguishes observed contributions. It was assembled by Codex on November 6, 2026 from the current conversation and artifacts; earlier work is not backdated here.

## Current evidence

- **User:** supplied the Sacred website/docs and organiser screenshots and implementation constraints; specified deadline, simplicity, priority of an end-to-end demo, Fable review before implementation, and small sequential commits.
- **Existing Sacred material:** public design/site and older repository code existed beforehand. Their complete authorship history has not been reconstructed in this log.
- **Codex:** researched current public protocol and integration documentation; drafted the specification and staged prompts; checked arithmetic examples; incorporated an internal consistency review; prepared plan, commit and Fable-review handoffs. These artifacts are AI-assisted, not presented as solely human-authored.
- **Claude Fable:** review supplied by the user on November 6,2026; identified integration, sizing, hosting, queue and Git issues. See review dispositions for accepted changes and corrections.
- **Arc Studio:** intended implementation tool; no code generation, deployment or transaction has been performed through Studio in this workflow yet.
- **Verification so far:** specification arithmetic and prompt-length/package checks. This is not a claim that future Solidity, API or end-to-end tests have passed.

## Update format

For each real checkpoint record: date/time; actor/tool; feature or decision; source/prompt/review reference; actual validation; commit SHA; Studio trace/project URL when available. Record human understanding and review through concrete decisions and feedback, not invented line-of-code percentages.

## Review checkpoint

Fable review: received. Codex dispositions: complete. Final specification: v0.3 pinned for implementation preflight. See output/arc-studio-hackathon/REVIEW_STATUS.json.

## November 6 review integration

- User requested ETHSkills, design resources and selected Matt Pocock skills. Codex installed pinned upstream revisions; installed sources and scope are documented in SKILLS.md.
- Codex independently checked Arc Testnet block 71009777: contract bytecode, three PoolManager identity getters, existing EURC pool liquidity and uninitialized cirBTC pool. No transaction was sent.
- Codex corrected reserve/trade requirements, the integer partial-sale scaling factor and dust-limited coverage bands. Kept an independent admin-controlled testnet fixture and preserved primary/tail/backstop ordering.
- Codex revised specification, prompts, local Git workflow and public plan; application generation remains a later Studio step. Skills installed locally do not imply they ran inside Studio.

## Reviewed handoff commits

Signed planning commits in `sacred-markets`, branch `codex/arc-mvp`, based on `b5b8906`:

| SHA | Change | Changed lines |
| --- | --- | --- |
| af8fecb | docs: establish MVP plan and contribution record | 86 |
| 2dd0a22 | docs: specify reviewed sale financing MVP | 297 |
| 20624d2 | docs: record review fixes and verification evidence | 119 |
| be337f2 | docs: define Studio checkpoint and local Git workflow | 110 |
| 3873e13 | docs: add contract and integration build checkpoints | 29 |
| e5b0119 | docs: add app verification and delivery checkpoints | 32 |
| 4ac4e30 | docs: document installed MVP engineering and design skills | 54 |

Validation: reviewed spec hash matches both copies; all seven prompts fit the10,000-character cap and select one checkpoint; root document links resolve; public handoff excludes internal strategy; arithmetic and read-only RPC checks are documented. Application tests and deployments have not run.
