# Studio generates; local Git records and publishes

There are three separate operations: **Studio build**, **CLI pull to disk**, and **Git commit/push**. The pull is a file download; it does not push to GitHub. Codex performs the local review and Git steps after each small Studio checkpoint. The user provides one Studio login/app ID and handles wallet/host authorization when needed.

## Once

```sh
npm install -g @circle-fin/arc-studio-cli@1.2.2
arc-studio login
arc-studio apps --json
export SACRED_APP_ID='REPLACE_WITH_ACTUAL_APP_ID'
export SACRED_REPO='/Users/smitrajput/Projects/halal-defi/sacred-markets'
git -C "$SACRED_REPO" switch -c codex/arc-mvp
```

If that branch already exists, switch to it without `-c`. Keep the browser in the same Studio app and chat. `run --app` starts a new chat thread, so it is not the preferred continuation path. `--session` is the CLI alternative when building through a named session from the beginning.

## After each Studio checkpoint

1. Wait for Studio's changed-file list and actual test result. Do not start the next checkpoint yet.
2. Preview and download to the local repository:

```sh
arc-studio pull --app "$SACRED_APP_ID" --out "$SACRED_REPO" --dry-run --diff
arc-studio pull --app "$SACRED_APP_ID" --out "$SACRED_REPO"
git -C "$SACRED_REPO" status --short
git -C "$SACRED_REPO" diff --check
git -C "$SACRED_REPO" diff --stat
git -C "$SACRED_REPO" diff
```

First pull must be full. After every turn has been captured, `--changed` can narrow subsequent pulls; use the full dry-run as a completeness check. New untracked files require direct review too: `git diff` alone does not show them. Compare Studio's file list with local files; CLI download deletion behavior is unverified, so handle reported deletions explicitly after review.

3. Run the checkpoint's relevant check (for example `forge test` from the generated Foundry root, or the actual package's typecheck/build scripts). A syntax check is not an end-to-end test. Inspect ABI changes and generated files before staging.
4. Stage only the named files/hunks for this behavior. Example **after those files actually exist**:

```sh
git -C "$SACRED_REPO" add contracts/src/MarginVault.sol contracts/test/MarginVault.t.sol
git -C "$SACRED_REPO" diff --cached --check
git -C "$SACRED_REPO" diff --cached --stat
git -C "$SACRED_REPO" diff --cached
git -C "$SACRED_REPO" commit -m 'feat(vault): price deposits at current NAV'
git -C "$SACRED_REPO" push -u origin codex/arc-mvp
```

5. Record SHA, actual tests and Studio trace in AI_WORKLOG.md, then send the next checkpoint. If one turn produced multiple independent behaviors, stage/commit them separately and keep each checkpoint buildable. Do not manufacture a sequence after the full app has been generated.

## Conflicts and evidence

- Exit2 means the pull skipped a local edit. Keep the local file, inspect the Studio version with `arc-studio cat`, and reconcile that file deliberately. A force pull is not a default recovery action.
- Plans and review docs are local-owned. Generated app code is Studio-owned; request implementation corrections in the same Studio chat. Document any necessary local implementation edit honestly.
- Dependencies/lockfiles/generated ABIs get separate commits. A generated lockfile can exceed the usual line budget; report that fact rather than splitting an invalid file or hiding it among features.
- Studio GitHub export is optional. Do not assume its UI lets us choose a branch or preserve commit boundaries. Our canonical branch is pushed with normal Git, and Studio provenance is the share URL, traces and demo.
- Never pull `.env*`/secret context with `--all` into the repository. Keep the CLI's local sync metadata uncommitted; inspect its actual filename after the first pull before adding an ignore rule.

Verified syntax: [Arc CLI reference](https://docs.arc.io/ai/arc-studio-cli). A repository push is performed only after the full staged diff has been reviewed for project scope and private information.
