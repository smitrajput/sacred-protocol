# Checkpoint 00a — November 6, 2026

Status: scaffold accepted; v4 and financial-contract implementation remain upcoming.

## Provenance

- Arc Studio generated the scaffold in app `37c6c8dc-b313-49c9-9cbb-fe5f61673ab3`.
- Codex pulled the export with CLI 1.2.2, preserving the existing README and local plan files.
- Local validation reproduced a missing `@circlefin/compass-chains` dependency in unused `compass-deploy.ts`, contrary to the initial Studio summary.
- Studio cleanup thread `868bf545-07ba-4ecd-a97c-b45762be5d3c` removed four unused generic deployment/ABI scripts and their commands, and corrected the duplicated testnet heading. Codex reconciled those deletions locally.
- Codex adjusted dependency packaging and normalized trailing blank lines: all 68 exported forge-std files match upstream v1.16.2, commit `bf647bd6046f2f7da30d0c2bf435e5c76a780c1b`. A Git submodule avoids vendoring the library. Local metadata/build output are ignored.

## Independent checks

| Check | Result |
| --- | --- |
| Bun 1.3.14 frozen install | Passed, 838 packages |
| Initial lint/typecheck | Failed on unused Compass dependency; fixed through Studio cleanup |
| Lint/typecheck after cleanup | Passed |
| Production Vite build | Passed; dependency annotation and chunk-size warnings |
| `forge build --force`, repository root | Passed, 20 files, Solc 0.8.28 |
| `forge build --force`, contracts directory | Passed, 20 files, Solc 0.8.28 |
| `bun run verify:onchain` | 13 PASS checks, Arc chain 5042002, observed block 71016364 |
| Browser inspection | App renders; both live token checks match; contracts display Not deployed; corrected heading confirmed |

No transactions were broadcast. Solidity compilation covers starter scripts/dependencies; no Sacred contract tests exist yet. Token bytecode, metadata and hashes were checked; proxy implementations/admins were not inspected. The browser's Config chain reflects the injected wallet chain and can differ from the explicitly Arc-scoped token reads; replace it with clear wallet-network UX in the frontend checkpoint.

CLI reported 1% of its 24-hour allowance used at the initial review check. This is not a token quota or a confirmed model identity.
