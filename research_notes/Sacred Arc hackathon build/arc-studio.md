# Arc Studio limits and build workflow

## What is actually known about usage limits and models

### Takeaway
Arc Studio has daily and rolling 30-day LLM allowances, potentially applied at both user and organization scope. The exact dollar/token/request cap and served model identities are not publicly established by the official sources inspected; the percentage meter is meaningful, but cannot be translated into a fixed number of prompts.

### Cited Findings
- The official FAQ confirms a complimentary daily allowance and a project-download escape hatch once it is exhausted. It does not give an absolute quota or reset timezone. — [Studio FAQ](https://studio.arc.io/)
- Circle's published CLI README describes `arc-studio usage --json`: `{ percentUsed, windowMs, scope, usageLimitIncreaseActive, usageLimitIncreaseExpiresAt }`. It reports the daily or rolling 30-day cap closest to blocking, at user or organization scope. No dollar amounts are exposed. The public web client additionally reads `windows` for its short/long-window display. — [Circle CLI package](https://www.npmjs.com/package/@circle-fin/arc-studio-cli), [official npm metadata](https://registry.npmjs.org/@circle-fin/arc-studio-cli), [public Studio client inspected Nov 5](https://studio.arc.io/assets/Chat.client-B5EDCy-k.js)
- A one-time paid organization usage increase lasts one month, shared across members; billing-admin access is needed. `arc-studio upgrade --no-open` prints the upgrade URL, and the web UI has Settings → Plan → Get a usage limit increase when eligible. The amount and multiplier are account-dependent/unverified here. It does not automatically renew. — [Circle CLI package](https://www.npmjs.com/package/@circle-fin/arc-studio-cli), [Studio upgrade](https://studio.arc.io/upgrade), [public Studio client](https://studio.arc.io/assets/Chat.client-B5EDCy-k.js)
- Terms §3.1 say Studio uses one or more third-party LLMs, subject to change without notice; they do not name providers or model versions. §5.2 permits usage limits to change. — [Studio terms](https://studio.arc.io/terms-of-use)
- The `Eco Sauce` chip in the user's screenshot is a selected integration skill, described by the public client as atomic multi-step onchain programs (`skillPaths: ["eco-sauce"]`), not a model selector. — [public Studio client](https://studio.arc.io/assets/Chat.client-B5EDCy-k.js)
- CLI results expose trace ID, changed files/diffs, deployment addresses/network/transactions, artifacts, and budget status; the documented result schema does not identify the inference model. Arc Studio's trace panel documents app RPC/HTTP calls, transactions, and decoded events, not model-provider provenance. — [Circle CLI package](https://www.npmjs.com/package/@circle-fin/arc-studio-cli), [Studio tracing](https://studio.arc.io/)

### Inferences
- Treat the UI's “24 hours” and the CLI's “daily” as a capacity window; do not assume an IST-midnight reset. The 30-day window is explicitly rolling. Exact daily reset semantics remain unverified.
- Monitor percentage before and after each real build milestone. A short prompt can trigger a long agent run, so prompt count is not a reliable quota budget.
- Retain roughly 30–40% headroom for repair/deployment/rehearsal if practical. This is planning judgment, not a vendor-published threshold.
- Remove the Eco Sauce skill for the initial build unless intentionally using that infrastructure; select only the integration skills needed for the chosen scope.
- Exact models are a low-priority unknown for the deadline. Behavior should be judged using compile/test/invariant results, not a guessed brand name.

### Gaps
- No verified absolute daily/monthly cap, currency/token basis, remaining request count, precise daily reset time, upgrade price/multiplier, or actual model ID.
- No account-specific API call was made. `arc-studio` is not installed locally; Node/npm are available. No login, credential reading, generation, payment, or external write occurred.
- A signed-in user can inspect Settings → Plan and their usage meter. A read-only `GET /api/usage` response (the official frontend's endpoint) may show both windows; it should be inspected within their existing browser session, without exporting cookies/tokens. Even this endpoint may expose only percentages.
- For model certainty, ask Circle support to identify the active provider/model routing and whether it varies by planning, coding, and review. No support message was sent.

## Is Arc Studio the right authoring route and how should the spec be handed over

### Takeaway
Arc Studio provides a shared contract/app workspace and a visible build, test and deployment history. Author and review the specification separately, then implement in that workspace. The browser is the lowest setup-cost route; CLI orchestration supports systematic review.

### Cited Findings
- Circle explicitly supports driving Studio from Codex, Claude Code, or Cursor; the Studio agent, inference, contract pipeline, and sandboxes remain server-side. CLI runs return a Studio workspace URL. — [Arc Studio introduction](https://www.arc.io/blog/introducing-arc-studio-the-onchain-coding-agent), [CLI package](https://www.npmjs.com/package/@circle-fin/arc-studio-cli)
- The current published CLI version is 1.2.2 as inspected Nov 5, 2026. Its README specifies Node >=20, prompts capped at 10,000 characters, read-only reference uploads via `--file`, and a Vite + Foundry sandbox (`src/`, `contracts/`). Upload caps are 100 files, 1 MB/file, 10 MB total for ordinary users. — [official npm metadata](https://registry.npmjs.org/@circle-fin/arc-studio-cli)
- `--file spec.md` goes into read-only `context/`; `--file local:path` supports round-trip files. Public GitHub repositories can be cloned server-side; private cloning is not supported by the documented CLI. `pull --changed --dry-run --diff` supports review before local writes. — [CLI package](https://www.npmjs.com/package/@circle-fin/arc-studio-cli)
- Studio provides live preview, contract read/write panels, testnet deployment, and app request/transaction traces. Circle's revenue-split tutorial demonstrates contract generation, tests, UI, deployment, and real testnet USDC flows. — [Studio](https://studio.arc.io/), [Circle revenue-split tutorial](https://www.arc.io/blog/build-a-usdc-revenue-splitting-app-with-arc-studio-no-code-required)

### Inferences
- Use one persistent Studio project, incrementally implement contract tests → core contracts → backend/read model → frontend wiring → demo, and save a checkpoint after every milestone. “One contract per session” is unnecessary; many fresh sessions lose chat context. Prefer one bounded milestone per prompt.
- Provide the complete spec as a reference file, then keep each execution prompt below 10,000 characters. If staying browser-only, paste ordered smaller sections rather than one giant specification.
- Choose Vite/React/TypeScript + Foundry unless Studio identifies an existing supported scaffold. Do not force a Next.js migration merely for preference. A simple backend requirement must still be fulfilled, not implied by a static UI; have Studio generate a lightweight API/worker supported by its environment.
- CLI orchestration retains server-side Studio authorship and is documented as a supported product workflow. Show the Studio web project, history, contract pipeline and traces to make implementation evidence easy to inspect.
- Small local edits and re-import are product-supported. Retain a clear record of where code was authored, tested, deployed and reviewed.
- Do not spend the last build hours on a model-identification investigation; enough operational visibility exists to manage quota and preserve checkpoints.

### Gaps
- The current task is specification only. The following commands are verified usage guidance and were not executed:

```sh
npm install -g @circle-fin/arc-studio-cli@1.2.2
arc-studio login
arc-studio usage --json
arc-studio agent-guide
arc-studio run --prompt-file ./01-bootstrap.txt --file ./sacred-arc-spec.md --output json
arc-studio pull --changed --dry-run --diff
arc-studio deployments --json
arc-studio open
```

The user handles the browser authorization during `login`. No `skills install --tool claude-code` step is needed for Codex. Keep secrets out of prompts and spec files. For later stages, follow `agent-guide`'s current session-continuation syntax; the existing project and remote files should be preserved. These commands assume the named local prompt/spec files have been created.

## What verified Arc configuration belongs in the build spec

### Takeaway
Use Arc Testnet chain ID 5042002 and native USDC's ERC-20 interface for all application accounting. Treat native gas precision and ERC-20 precision separately; they represent the same balance.

### Cited Findings
- Network: Arc Testnet; RPC `https://rpc.testnet.arc.io`; chain ID `5042002`; currency `USDC`; explorer `https://explorer.testnet.arc.io`. — [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- USDC ERC-20 address `0x3600000000000000000000000000000000000000`, 6 decimals. Native gas balance is 18 decimals; the two interfaces share one underlying balance, so do not add them. No wrapped USDC is needed. — [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses), [USDC interfaces](https://www.arc.io/blog/building-with-usdc-on-arc-one-token-two-interfaces)
- Official testnet cirBTC `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` (8 decimals); WETH `0x2c4047028a72803939b6fb674D01bC059B5C4961` (18 decimals); EURC `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 decimals). These are documented addresses, not proof of faucet access or liquid AMM routes. — [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- Arc Testnet CCTP domain is `26`; CrossChainTokenService `0x63753E722bd2C2A5DF6EE19C5106662208B81077`; TokenMessengerV2 `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`. Integration work should re-read current SDK documentation rather than assume older CCTP addresses. — [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- Studio can deploy from its Circle-managed wallet to Arc Testnet. Its own wallet does not deploy mainnet. — [Studio FAQ](https://studio.arc.io/)

### Inferences
- All USDC accounting should use integer micro-USDC, explicit decimals in the frontend, and ERC-20 transfers/approvals. Retain a small wallet gas balance instead of depositing the entire USDC balance.
- Pin addresses and expected decimals in a deployment manifest; validate `chainId`, contract code, and `decimals()` at startup. Never silently replace official tokens with a mock labeled as cirBTC.
- Document a test asset clearly if the minimum demo uses one, and describe integrations only after they have been verified.

### Gaps
- No chain transactions were submitted, no liquidity or faucet allocation was tested, and no mainnet deployment is needed for this specification.
