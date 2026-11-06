# Sacred AI work log

This log distinguishes observed contributions. It was assembled by Codex on November 6, 2026 from the current conversation and artifacts; earlier work is not backdated here.

## Current evidence

- **User:** supplied the Sacred website/docs and organiser screenshots and implementation constraints; specified deadline, simplicity, priority of an end-to-end demo, Fable review before implementation, and small sequential commits.
- **Existing Sacred material:** public design/site and older repository code existed beforehand. Their complete authorship history has not been reconstructed in this log.
- **Codex:** researched current public protocol and integration documentation; drafted the specification and staged prompts; checked arithmetic examples; incorporated an internal consistency review; prepared plan, commit and Fable-review handoffs. These artifacts are AI-assisted, not presented as solely human-authored.
- **Claude Fable:** review supplied by the user on November 6,2026; identified integration, sizing, hosting, queue and Git issues. See review dispositions for accepted changes and corrections.
- **Arc Studio:** generated checkpoint 00a and its cleanup in the app linked below. No Sacred deployment or transaction has occurred.
- **Verification so far:** specification arithmetic, prompt checks and 00a scaffold validation. Financial contract and end-to-end tests remain upcoming.

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

## Browser handoff correction — November6

The user supplied a Studio screenshot showing a10,000-character rejection for the1,984-character first prompt with the37,650-character spec attached. Earlier validation checked prompt files alone and did not establish browser attachment behavior. Codex replaced attachment-dependent prompts with self-contained messages below8,500 UTF-16 units, corrected the instructions and kept protocol requirements. The screenshot confirms rejection; the exact browser counting mechanism and corrected send acceptance are not yet independently observed.

## Checkpoint 00a — 2026-11-06T16:20+05:30

Arc Studio generated the scaffold and corrected unused starter tooling after Codex reproduced a local typecheck failure. Codex pulled and reviewed the files, pinned the byte-identical forge-std release as a submodule, normalized trailing blank lines in five exported config/entry files, preserved prior-work documentation and performed the checks in [CHECKPOINT_00A.md](docs/review/CHECKPOINT_00A.md).

Studio app: [Sacred](https://studio.arc.io/app/37c6c8dc-b313-49c9-9cbb-fe5f61673ab3). Cleanup thread: `868bf545-07ba-4ecd-a97c-b45762be5d3c`. All generation remains in that same app. No financial contracts, API or deployments are claimed for this checkpoint.

| SHA | Change | Changed lines |
| --- | --- | --- |
| e2caf62 | chore(deps): pin Studio scaffold packages and runtimes | 2361 |
| faadde8 | build(contracts): pin forge-std and align Foundry layouts | 114 |
| 917d040 | build(web): configure Vite TypeScript and lint checks | 238 |
| b92f89a | chore(studio): preserve generated chain metadata | 621 |
| 1a1a086 | chore(studio): preserve amount and receipt helpers | 590 |
| 5022713 | chore(studio): retain development transaction tracing | 501 |
| 4f87a59 | chore(studio): retain console capture and share integration | 378 |
| ef7f4d3 | feat(config): verify Arc token manifest with live reads | 140 |
| d378f7b | feat(scaffold): display live network and token status | 293 |

The 2,305-line generated Bun lockfile is kept in the dependency-only commit. Every remaining implementation/import commit is below 1,000 changed lines; the two Sacred-specific commits are 140 and 293 lines. Starter modules are labelled as imported Studio tooling, not newly designed protocol features.

## Automated execution and same-day finish — November 6

The user authorized Codex to prompt Studio directly for all remaining checkpoints and escalate blockers, and moved the hard finish to November 6 at 22:30 IST. Codex revised delivery gates and prompt timing without changing protocol economics. The first automated v4 dependency/interface checkpoint is running in the existing Studio app. Optional bridging is off the critical path.
