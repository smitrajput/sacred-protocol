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
