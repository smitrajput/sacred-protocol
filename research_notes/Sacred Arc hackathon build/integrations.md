# Sacred integration feasibility

## Product scope and implementation order

Build one cirBTC/USDC financing lifecycle with actual asset purchase, fixed-price resale, pledge custody, repayment and withdrawals. Use Uniswap v2 for spot execution and collateral sales. Consider release and transfer to Ethereum Sepolia only after the financing workflow is complete. Identity infrastructure is deferred.

### Engineering choices
- Preserve Studio build/test/deploy history and the specification review trail so a reviewer can reproduce the implementation.
- A simple v2 integration supplies the spot execution the protocol needs. Custom hooks add unnecessary implementation scope.
- Distinguish existing Sacred design/site/assets from newly implemented code in README.
- Document the deployment manifest, real transaction receipts, source licenses, setup and demo steps. Include developer feedback on the integration tools used.
- The working deadline supplied by the user is November 7, 2026 at 9:30 AM IST.

## What is the fastest genuine Uniswap integration on Arc

### Takeaway
Use a self-deployed, unmodified upstream Uniswap v2 factory/pair on Arc Testnet, seeded with official test USDC and official test cirBTC; write a narrow Sacred adapter for that one pair. Give Studio 60–90 minutes to produce one verified buy and sell before building finance around it. The timeframe is a planning judgment.

### Cited Findings
- Official Uniswap announced v2, v3, v4 and UniswapX live on Arc on September 16, 2026; the API chain ID is 5042. This establishes mainnet support. [Uniswap Arc announcement](https://blog.uniswap.org/pt-BR/uniswap-is-live-on-arc)
- The official v4 deployment page lists Arc 5042: PoolManager `0x8366a39CC670B4001A1121B8F6A443A643e40951`, PositionManager `0x6049c9a0e26405C0985f9E3685C87d0aE917f82B`, Quoter `0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94`. Its testnet list does not include Arc Testnet. [v4 deployments](https://developers.uniswap.org/docs/protocols/v4/deployments)
- Uniswap API supports Arc 5042, with Universal Router 2.1.2 `0x8702463e73f74d0b6765aBceb314Ef07aCb92650`. Listed API testnets are Ethereum Sepolia, Base Sepolia and Unichain Sepolia, not Arc Testnet 5042002. [Supported chains](https://developers.uniswap.org/docs/trading/swapping-api/supported-chains)
- Arc Testnet chain ID is 5042002, RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`; native gas is USDC with 18 decimals. [Arc connection details](https://docs.arc.io/arc/references/connect-to-arc)
- Official Arc token list gives testnet cirBTC `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` (8 decimals) and bridged WETH `0x2c4047028a72803939b6fb674D01bC059B5C4961` (18 decimals). USDC's ERC20 interface must be treated in 6-decimal units separately from native gas units. [Arc contracts](https://docs.arc.io/arc/references/contract-addresses)
- Upstream v2 factory source uses Solidity 0.5.16 and deploys pairs. Router02 is a separate upstream contract. V2 uses full-range reserves and fungible LP shares; v3/v4 add concentrated-liquidity mechanics. [Factory source](https://github.com/Uniswap/v2-core/blob/master/contracts/UniswapV2Factory.sol), [Router source](https://github.com/Uniswap/v2-periphery/blob/master/contracts/UniswapV2Router02.sol), [Uniswap AMM overview](https://developers.uniswap.org/docs/get-started/concepts/how-uniswap-works)

### Inferences
- Simplest deterministic path: pin upstream `@uniswap/v2-core` artifact/source, deploy its factory and create one USDC/cirBTC pair; transfer seed liquidity and mint LP shares. Keep dependency licenses and record the upstream commit/package version. Do not ask Studio to rewrite the AMM.
- Prefer a fixed pair adapter using the pair's actual reserves and `swap`, with exact input, min output, token-order normalization, balance-delta validation, and no arbitrary target/calldata. If Studio already handles Router02 easily, use its ERC20-to-ERC20 functions only. Avoid ETH/native wrapping paths; Arc's native asset is USDC, so Ethereum WETH assumptions are inappropriate.
- A small direct pair adapter avoids deploying WETH just to satisfy a router constructor. It must enforce min output and use upstream 997/1000 fee math; tests must cover both token orderings. Its addresses are immutables/config, not user supplied.
- Establish deployment provenance honestly as “self-deployed upstream Uniswap v2 on Arc Testnet.” It is genuine upstream integration but not an official Uniswap deployment. Record the deployed version, addresses and actual test results.
- Preflight: factory/pair bytecode; token0/token1; decimals; nonzero reserves; acquire and sell back a small amount; receipt hashes and before/after balances; max expected price impact for chosen demo size. Record the seeded pair address and liquidity in README.
- Do not use this thin, attacker-influenceable pair's spot price as a production liquidation oracle. For the hackathon use an explicitly labeled test price adapter with freshness checking, or a verified supported oracle if already available; verify real execution proceeds before applying liquidation accounting.
- If first buy/sell fails after 90 minutes, preserve adapter boundary and prioritize Arc acceptance; do not spend hours migrating to v4. A fake swap can support local unit testing but must not be shown or submitted as real Uniswap integration.

### Gaps
- No verified official Arc Testnet Uniswap deployment or liquid official test pair located. Mainnet addresses are not testnet configuration.
- Actual deployment compatibility, liquidity acquisition and Studio compiler/import support still require a smoke test. No deployment or real-money action was performed in this research.

## Can released cirBTC be bridged with Bridge Kit before the deadline

### Takeaway
The strongest optional flow is repay → release cirBTC to wallet → bridge to Ethereum Sepolia. Live Circle registry and quote checks support that route. Base Sepolia is not listed for cirBTC; do not offer it in the demo. A full Bridge Kit transfer remains the final preflight gate.

### Cited Findings
- CCTP expanded assets is a separate smart-contract layer using CCTP messaging and Iris attestation. USDC uses standard CCTP; configured non-USDC tokens use `CrossChainTokenService`, source-native fees and optional forwarding. [CCTP expanded assets](https://developers.circle.com/cctp/expanded-assets)
- Non-USDC is EVM-to-EVM; both services must trust each other. EURC/cirBTC are preconfigured custom assets, WETH an ownerless asset. Docs instruct querying Iris for environment-specific token IDs and enabled deployments. [Supported domains/tokens](https://developers.circle.com/cctp/expanded-assets/concepts/supported-chains-and-domains)
- Sandbox CrossChainTokenService is `0x63753E722bd2C2A5DF6EE19C5106662208B81077` on Sepolia domain0, Base Sepolia domain6 and Arc Testnet domain26, among others. Token-specific manager/address are resolved from that service. [Expanded-assets contracts](https://developers.circle.com/cctp/expanded-assets/references/contract-addresses)
- Bridge Kit remains available as standalone `@circle-fin/bridge-kit`, with Viem adapter `@circle-fin/adapter-viem-v2`; the old Bridge Kit docs redirect into App Kit docs. [Bridge overview/install](https://docs.arc.io/app-kit/bridge)
- Detailed current SDK quickstart accepts `token: "EURC"`, `"wETH"`, `"cirBTC"` or bytes32 tokenId. It explicitly warns that deployments do not imply every route is live, documents retryBridge, lifecycle events and explorer links, and requires whole-token decimal strings. [Bridge quickstart](https://docs.arc.io/app-kit/quickstarts/bridge-tokens-across-blockchains)
- The supported-token reference includes USDC/EURC/WETH/cirBTC and registered third-party assets. Standalone BridgeKit is documented with `getSupportedChains`. [App Kit support matrix](https://docs.arc.io/app-kit/references/supported-blockchains)
- Full live Iris sandbox registry retrieval: seven pages, 1,017 tokens, pagination exhausted. Official-symbol cirBTC entry had **only domains0 and26**, enabled, 8 decimals. Token ID `0x7c27b7b6485f3ea49b7d1a439e288d3c3116f533302afabb7e372dfc0770cc7d`; Arc token `0xf0c4a4ce82a5746abaad9425360ab04fbba432bf`; Sepolia token `0x3a3fe695f684bf9b9e43cf43c2b895ea5e392bb3`; manager `0xb995f4060c38b7608626d0ccabe547cdc2c7390a`. [Live Iris registry](https://iris-api-sandbox.circle.com/v2/cctpx/tokens?tokenid=0x7c27b7b6485f3ea49b7d1a439e288d3c3116f533302afabb7e372dfc0770cc7d). Snapshot stored alongside these notes as `cctpx-live-tokens.json`.
- WETH sandbox token ID `0xaa3cf4df2d82ec4b91da19afe54d414f637d068fe9cd52ba5e0e7e0d94f9eac8` likewise lists only Ethereum0 and Arc26. Official EURC ID `0x2587821a0ee7daa174b95436b5dab1731cfa1844775b010217d3c0dd02a4eecd` lists domains0,1,6,14,21,26. A second EURC-symbol token has only Arc26; symbol matching is not sufficient for token selection. [Iris tokens](https://iris-api-sandbox.circle.com/v2/cctpx/tokens?pageSize=150)
- Read-only POST fee quote for cirBTC domain26→0, amount10000 atomic (=0.0001 cirBTC), `feeToken` zero address, `requests: []`, returned HTTP200, a signed quote, and feeTotalAmount `200000000000000000` =0.2 native USDC on Arc. Quote issued at Unix1793903835, expires120 seconds later. This was standard finality/no forwarding and was not a transfer. [Iris quote endpoint](https://iris-api-sandbox.circle.com/v2/quote/cctpx/0x7c27b7b6485f3ea49b7d1a439e288d3c3116f533302afabb7e372dfc0770cc7d/26/0). Raw evidence `cirbtc-quote-check.txt`.
- Circle faucet advertises test USDC, EURC and cirBTC. [Faucet](https://faucet.circle.com/)

### Inferences
- Recommended `BridgeKit` configuration: `from.chain = "Arc_Testnet"`, `to.chain = "Ethereum_Sepolia"`, explicit verified cirBTC tokenId, browser wallet adapter, amount in whole BTC units (e.g. `"0.0001"`), destination same user wallet. Pin package versions after a smoke transfer; current docs include AppKit and standalone variants, so compile-check the actual installed BridgeKit signature.
- Preflight gate before implementing UI: verify current Iris route/address; source/destination `isTrustedDomain`; request quote with intended transfer speed and optional forwarding; perform one tiny transfer using BridgeKit; record source receipt, attestation, destination receipt and destination balance increase. This research completed registry and direct Iris quote checks only.
- Prefer bridge as a separate transaction after repayment/release confirms. Present a guided single flow with clear steps, not a promise of one atomic cross-chain transaction. Failed bridge must leave protocol debt paid and released assets in user custody. No bridge while collateral is pledged.
- Persist bridge state locally by chain/wallet/source tx hash; resume attestation/mint rather than repeating burn. UI states: awaiting signature, source confirmed, attesting, destination pending, completed, recoverable error. Receipt/explorer links each step; disabled button while in progress.
- Use the **standalone BridgeKit** dependency for the verified asset-transfer flow and document its import/call in README. Do not rely only on raw low-level CCTP or Gateway and label it BridgeKit.
- A valid standard/no-forward quote does not prove fast/forwarded mint support. Start with proven standard route; add forwarder only if the installed SDK produces a valid quote and rehearsal succeeds. Recipient needs Sepolia ETH for self-mint; keep Arc native USDC for source gas and protocol fee.
- If the BridgeKit route cannot complete within a 60-minute integration budget after the core works, defer bridging and keep the core stable. A second market is outside the initial product scope.

### Gaps
- No actual token transfer was initiated. Exact standalone BridgeKit installed version and execution path have not been compile/execution checked.
- No timed attestation SLA measured; do not promise instant settlement or a fixed bridge duration.

## Why omit ENSv2 for this build

### Takeaway
ENSv2 can be substantive but needs a separate identity/permission product responsibility on Sepolia or Ethereum. That does not improve the critical Sacred financing demo enough to justify deadline risk.

### Cited Findings
- ENSv2 supports hierarchical permissioned registries/resolvers. Current official app guide recommends ENSv2-ready viem/wagmi/ethers/ENSjs and chain selection rather than pinning Universal Resolver implementation addresses. [ENS app guide](https://docs.ens.domains/ensv2/tutorial-app-developers/), [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/)
- Official releases include a September15 Sepolia deployment; older July deployment was superseded. [ENS contracts releases](https://github.com/ensdomains/contracts-v2/releases)

### Inferences
- A separate identity layer would require namespaces, meaningful delegated permissions and cross-chain linkage to Arc. These responsibilities are outside the financing workflow and are deferred.

### Gaps
- No live ENSv2 name or registry was created or tested in this research; irrelevant to the recommended scope.
