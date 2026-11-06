# Sacred hackathon plan

Status: **REVIEW_CANDIDATE — awaiting Claude Fable review. Implementation has not started in this workflow.**
Deadline: **November 7, 2026, 9:30 AM IST**. Submit by **7:30 AM IST**.

## Files and responsibilities

- [Specification](output/arc-studio-hackathon/spec.md): complete proposed contract, frontend, backend and demo requirements; drafted by Codex from public Sacred docs and integration documentation.
- [Fable review prompt](output/arc-studio-hackathon/CLAUDE_REVIEW_PROMPT.md): send with the specification, this plan and the commit plan.
- [Commit plan](output/arc-studio-hackathon/COMMIT_PLAN.md): small sequential implementation checkpoints.
- [Review status](output/arc-studio-hackathon/REVIEW_STATUS.json) and [review decisions](output/arc-studio-hackathon/REVIEW_DECISIONS.md): gate and actual findings/dispositions.
- [Prompt instructions](output/arc-studio-hackathon/README.md): exactly how to use the numbered Arc Studio prompts after review.
- [AI work log](AI_WORKLOG.md): contributions and evidence, updated as work occurs.
- [Organiser guidance](output/arc-studio-hackathon/ORGANISER_GUIDANCE.md): summary of the four supplied slides.

## Sequence

1. Codex completes the review-candidate specification and prompt pack. **Complete.**
2. Claude Fable reviews that exact candidate. **Pending.**
3. Codex records each material finding, makes justified fixes, synchronizes affected prompts and records the final spec hash. **Pending.**
4. Set READY_FOR_IMPLEMENTATION only after review is incorporated and critical issues resolved; preserve the user's chosen review order. **Pending.**
5. Build in Arc Studio one checkpoint at a time, test it, inspect its diff and commit before the next checkpoint. **Pending.**
6. Rehearse the real core demo; add bridge only if time permits; record video and submit. **Pending.**

## Locked scope and decisions

- Human direction evidenced in this chat: follow current Sacred design, ship a simple end-to-end demo, use Fable review before implementation, and preserve small clear commits.
- Codex proposal pending that review: one cirBTC market, Earn/Trade/Activity, one initial funding cohort, real read API, bounded keeper, Uniswap v2, optional bridge to Ethereum Sepolia.
- Existing Sacred website/design/code predate this new implementation. Disclose reused work; this plan does not assert who authored all historical work.
- Financial acceptance covers ownership before sale, fixed markup, collected 77/23 split, principal-first settlement, 160/190 coverage, FIFO withdrawals and explicit losses.
- Do not grow scope during review. Record brief rationale for accepted, deferred or rejected changes.

## Evidence to add while building

For each checkpoint append: feature, responsible tool/person, key decision, tests actually run, commit SHA and Studio trace/project reference. Add real user feedback and resulting changes when received. Do not fabricate historical plan files, backdate entries, invent test passes or estimate a human/AI percentage from commit counts.

The organisers recommend plan files in the repo; PLANS.md is our chosen index, not an organiser-mandated filename. This file is a current plan assembled by Codex from the conversation, not a verbatim historical transcript.
