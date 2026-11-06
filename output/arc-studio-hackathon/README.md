# Use the revised handoff

Fable review is incorporated in **v0.3**. REVIEW_DECISIONS.md explains accepted fixes and corrected math. Ready for implementation preflight; no app build/deployment has been performed by this handoff. Deadline **November 7,2026,9:30 AM IST**; target submission 7:30 AM.

## Your next steps

1. Open one Sacred app in Arc Studio. Select the **Uniswap skill** and remove Eco Sauce. Attach the revised `spec.md`.
2. Paste all of `00-preflight.txt`. Its default CURRENT CHECKPOINT is00a: Studio does only that small part and stops.
3. Give Codex the Studio app ID/share URL and complete one CLI login. Codex pulls that checkpoint into `sacred-markets`, inspects/tests it, commits the coherent diff and pushes the branch using normal Git. See STUDIO_GIT_WORKFLOW.md for the exact commands.
4. After that checkpoint is captured, send `Continue 00b`, then00c in the same Studio chat. When00 is complete, attach/paste01 (starts01a), then continue01b/01c. Follow02a–e,03a–e,04a. Run05 only if core works and time remains; finish06.
5. Send any failures back to Codex with the actual output; fixes go into the same Studio project. Attach an updated spec only if a material decision changes. Never paste all numbered prompts at once.

**You do not manually shuttle each code file or create the commits.** Studio handles code generation; Codex handles CLI pull, verification and local Git. Wallet signatures, Studio login and host-account access remain yours when the platform requires them.

## Pack layout

- spec.md — complete behavior, parameters and acceptance criteria.
- 00–06.txt — staged prompts, one selected checkpoint per turn.
- STUDIO_GIT_WORKFLOW.md / COMMIT_PLAN.md — download, review, commit and push mechanics.
- REVIEW_DECISIONS.md / SPEC_VERIFICATION.md / ARC_V4_READ_CHECK.json — technical review and verification evidence.
- REVIEW_STATUS.json — spec hash and current stage.
- SKILLS.md / INSTALLED_SKILLS.json — installed local skills, revisions and intended uses.
- Root PLANS.md / AI_WORKLOG.md — public plan and honest contribution record.

In the implementation repository these live under `docs/`, with prompts under `docs/prompts/` and review evidence under `docs/review/`. The private original review text is not part of the distributed pack. Exact served Studio models and absolute usage limits remain undisclosed; use `usage --json` for available percentages/windows/scope.
