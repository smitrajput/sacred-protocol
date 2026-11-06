# Sequential commit plan

A milestone prompt can produce several commits. Before starting implementation, preserve the current repository baseline SHA and the approved spec hash in the work log. Use a dedicated branch; retain pre-existing history and Studio provenance.

## Checkpoint loop

1. State one small behavior and its acceptance check.
2. Generate that behavior in Studio, with its relevant tests; keep unrelated files untouched.
3. Run the check. Inspect `git diff --check`, `git diff --stat` and the actual diff.
4. Stage only named files/hunks for this checkpoint. Commit before starting the next behavior.
5. Record the SHA, actual validation and Studio trace in the work log; continue without seeking routine extra approval.

Aim for 50–300 handwritten changed lines. Split larger features at coherent boundaries. Do not make a 1,000-plus-line catch-all commit. Dependency/lock/generated changes belong separately; if an indivisible generated file makes that limit impossible, report it before committing rather than silently ignoring the constraint or breaking the file. Pin upstream dependencies instead of dumping vendored trees into a feature commit.

If Studio lacks fine-grained Git controls, stop after each checkpoint, export/pull that checkpoint, inspect and commit locally, then resume in the same Studio project. Do not wait until the whole app exists to export one giant diff. Commit messages describe the behavior; their bodies give why, validation and agent role. Never rewrite history to create a fictitious development chronology.

## Planned order

### Prompt 00 — preflight

- `chore: establish Arc testnet scaffold and manifest`
- `build: pin canonical Uniswap dependencies`
- `test: prove seeded pair buy and sell`

### Prompt 01 — vault

- `feat(vault): add funding phase and share accounting`
- `feat(vault): add FIFO withdrawal reservations and claims`
- `feat(vault): segregate protection and loss accounting`

### Prompt 02 — trading

- `feat(trade): add guarded venue and demo price adapter`
- `feat(trade): implement purchase sale and pledge opening`
- `feat(trade): add principal first repayment and markup split`
- `feat(trade): add partial sale and maturity settlement`
- `test(trade): enforce accounting and custody invariants`
- `chore: record verified testnet deployments`

### Prompt 03 — application

- `feat(api): expose contract backed read endpoints`
- `feat(keeper): add simulation receipt tracking and retries`
- `feat(ui): add Earn funding and withdrawal flow`
- `feat(ui): add Trade opening and repayment flow`
- `feat(ui): show activity and transaction failure states`

### Prompt 04 — verification

- `test(e2e): verify complete financing and withdrawal demo`
- Separate fixes by the behavior they repair; do not combine unrelated failures.

### Prompt 05 — optional bridge

- `feat(bridge): add released cirBTC transfer and recovery`
- `test(bridge): record successful transfer rehearsal`

### Prompt 06 — delivery

- `docs: document architecture provenance and integration evidence`
- `docs: finalize demo and submission materials`

These are planned boundaries, not commits claimed to exist. Adjust boundaries when a smaller coherent change is needed; do not add dummy commits to inflate the count.
