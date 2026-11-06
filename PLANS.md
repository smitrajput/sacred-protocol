# Sacred implementation plan

Status: **READY_FOR_IMPLEMENTATION — Fable review incorporated in v0.3; next 00a preflight.** No application build has started in this workflow. Deadline **November 7,2026,9:30 AM IST**, target submission 7:30 AM.

- [Specification](output/arc-studio-hackathon/spec.md)
- [Prompt instructions](output/arc-studio-hackathon/README.md)
- [Studio/local Git workflow](output/arc-studio-hackathon/STUDIO_GIT_WORKFLOW.md) and [commit plan](output/arc-studio-hackathon/COMMIT_PLAN.md)
- [Review dispositions](output/arc-studio-hackathon/REVIEW_DECISIONS.md), [math checks](output/arc-studio-hackathon/SPEC_VERIFICATION.md), [status/hash](output/arc-studio-hackathon/REVIEW_STATUS.json)
- [Skills](output/arc-studio-hackathon/SKILLS.md), [organiser guidance](output/arc-studio-hackathon/ORGANISER_GUIDANCE.md), [AI work log](AI_WORKLOG.md)

## Decisions and sequence

1. User direction: current Sacred economics, small end-to-end demo, Fable review before implementation and clear sequential commits.
2. Codex specification and Fable review: complete. Codex incorporated justified findings, corrected review arithmetic and preserved the separate protection waterfall.
3. Scope: one cirBTC market, existing v4 pool infrastructure, Earn/Trade/Activity, NAV deposits, continuous FIFO, separate admin demo-price fixture, real read API, gas-funded keeper plus manual path. Optional bridge follows a passing core.
4. Implementation lives in `smitrajput/sacred-markets`, local sibling checkout `sacred-markets`. Studio generates one checkpoint; Codex pulls, checks, commits and pushes before the next checkpoint.
5. First preflight proves affordable pool/position sizing, token funding, actual v4 execution and hosting access. Freeze actual amounts/roles in the deployment manifest.
6. Finish contracts by 21:00, app/rehearsal 00:30, freeze 02:00, video 04:00 and submit 07:30. Drop optional bridge first if gates slip.

Existing Sacred website/design/code predate this implementation. Preserve prior-work disclosure and real chronology. For each checkpoint record actor, decisions, actual tests, SHA and Studio trace in AI_WORKLOG.md. Plan files explain the process; they do not estimate a human/AI authorship percentage.

Browser handoff correction: paste the self-contained checkpoint messages without attaching the full spec. Start with00-preflight.txt; the browser-safe message order is in the prompt instructions. CLI --file behavior is not inferred from browser attachments.
