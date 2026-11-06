# How to use this handoff

**Current step: Claude Fable review. Do not run 00–06 yet.**
Deadline: **November 7, 2026 at 9:30 AM IST**; target submission **7:30 AM IST**.

## Now — review the specification

1. Open Claude with Fable selected.
2. Attach `spec.md`, `PLANS.md` and `COMMIT_PLAN.md` from the review pack. `ORGANISER_GUIDANCE.md` supplies the slide summary if needed.
3. Paste the text of `CLAUDE_REVIEW_PROMPT.md`. Ask for review findings, not implementation.
4. Bring Claude's full response back to this Codex chat. Codex will assess the findings, make justified fixes, update the prompts and log, and freeze the final spec hash. Fable review has not been performed by this pack.

## After review and revisions — build in Arc Studio

1. Use the revised pack, with `REVIEW_STATUS.json` set to `READY_FOR_IMPLEMENTATION` and its approved hash matching `spec.md`.
2. Create one Sacred project. Remove Eco Sauce unless intentionally needed. Attach the actual final `spec.md`, `PLANS.md`, `COMMIT_PLAN.md` and `REVIEW_STATUS.json`. A link to a private Page is not a substitute for files Studio can read.
3. Paste the complete contents of `00-preflight.txt` into Studio and send it. This is an implementation prompt, not a shell command.
4. Let Studio complete its small checkpoint loop: implement one behavior → test → inspect diff → commit → next checkpoint. Multiple checkpoints inside a prompt must remain separate commits. Save Studio traces and commit SHAs.
5. Advance through **01 → 02 → 03 → 04** only when the current milestone is complete. Fix failures in that same project. Run optional **05** only if core verification is green and time remains; finish with **06**.
6. Do not paste all prompts together or start a fresh project for each. If a changed spec conflicts with an old prompt, stop and resynchronize them; the approved spec is canonical.

If the web interface cannot attach files or preserve checkpoint commits, use the documented CLI/file handoff, or export each checkpoint for local Git review and commit. Keep code generation in Studio. Codex can orchestrate that later once the Studio session is authorized; no such build has begun yet.

## CLI alternative after the review gate clears

From the extracted final pack:

```sh
npm install -g @circle-fin/arc-studio-cli@1.2.2
arc-studio login
arc-studio usage --json
arc-studio agent-guide
arc-studio run --prompt-file ./00-preflight.txt --file ./spec.md --file ./PLANS.md --file ./COMMIT_PLAN.md --file ./REVIEW_STATUS.json --output json
```

Follow the current `agent-guide` for continuing the same project. Inspect with `arc-studio pull --changed --dry-run --diff`; use `arc-studio deployments --json` for deployment evidence. Each numbered prompt stays below the documented 10,000-character limit.

This pack contains a specification and workflow, not a deployed application. Registry and quote checks do not replace a real bridge rehearsal. Model identities and absolute Studio quotas remain undisclosed; `usage --json` exposes available percentages/windows/scope.
