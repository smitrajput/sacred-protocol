# Use the browser-safe handoff

The full specification remains the repository reference. **Do not attach spec.md in the Studio browser.** The browser rejected the earlier prompt plus37,650-character attachment. Each replacement message contains its own requirements and is below8,500 UTF-16 characters; actual send acceptance must still be observed in Studio.

## Recover the failed first message

1. Dismiss the failed send. Remove the spec.md attachment and keep the Uniswap skill selected.
2. Paste the complete contents of00-preflight.txt as plain text. It runs only00a and stops.
3. Keep this same Studio app/thread. Codex pulls, checks, commits and pushes after each checkpoint.

## Message order

| File | What to send next |
| --- | --- |
| 00-preflight.txt | Runs00a; next paste00b-v4-preflight.txt |
| 00b-v4-preflight.txt | Dependencies; then Continue00b adapter; then Continue00b smoke |
| 00c-hosting-preflight.txt | Hosting check |
| 01-vault-and-accounting.txt | Runs01a; then Continue01b and Continue01c |
| 02-trade-engine.txt | Runs02a; then Continue02b and Continue02c |
| 02d-settlement-and-verification.txt | Runs02d; then Continue02e |
| 03-frontend-and-backend.txt | Runs03a; then Continue03b through03e |
| 04-core-verification.txt | Core rehearsal and fixes |
| 05-optional-bridge.txt | Optional, only after core passes and before cutoff |
| 06-submission-package.txt | Delivery evidence and demo |

Paste one file per message, with **no attachment**. Continue messages are plain text, for example `Continue 01b`. The prompts preserve current economics, accounting and trust constraints. The additional files split oversized context; they do not add product scope.

Codex handles CLI pull, diff review, relevant checks and normal local Git commit/push. STUDIO_GIT_WORKFLOW.md has the exact commands. Wallet signatures, login and required account access remain yours. Locally installed skills are not automatically installed inside Studio.

External deadline November 7, 2026, 9:30 AM IST; hard finish November 6, 10:30 PM IST. Review evidence is under docs/review in the implementation repository; prompt files are under docs/prompts. Exact served Studio models and absolute usage quotas remain undisclosed.

Primary execution is now automated through Studio CLI by Codex: send one checkpoint, inspect result/files, run checks, commit and push, then continue. The user is contacted for credentials/account authorization, funding or product decisions that cannot be resolved from the approved spec. Browser copy/paste instructions above are fallback only.
