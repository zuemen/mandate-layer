# Colosseum Crypto World's Fair — Submission Branch

> 此分支為 **Colosseum Crypto World's Fair 黑客松**參賽專用，與 `master` 的正式版本分開維護。

| Item | Value |
|---|---|
| Hackathon | [Crypto World's Fair](https://colosseum.com/worldsfair) by Colosseum |
| Target track | Base (+ University Award) |
| Submission deadline | 2026-10-12 23:59 PT（台灣時間 2026-10-13 14:59） |
| Branch | `hackathon/colosseum-worldsfair`（從 `master` @ 76e7ea4 分出） |
| Frontend version | `7.6.0-colosseum.0`（master 為 `7.5.0`） |
| Agent packages | `0.2.0`（master 為 `0.1.0`） |

## Focus for this submission
PepeLab on-chain CFD + **x402 paid API layer and autonomous AI-agent trading** (see [`docs/DESIGN_x402_AI_AGENT.md`](docs/DESIGN_x402_AI_AGENT.md) and `agent/examples/x402-*`), deployed on Base.

## Rules to remember
- All submission content must be in English.
- One team per person, one project per team.
- Judged on functionality, impact, novelty, UX, open-source composability, business plan.

## Merge policy
This repo (`zuemen/pepelab-colosseum`) is a competition-only import of `zuemen/pepelab_onchain_cfd` (imported at `5bb8be3`, full history kept). Nothing is pushed back to the original repo.

## Isolation rule — this repo never touches the original deployment
The original project's contracts on Base Sepolia stay exactly as they are. This repo:
- deploys its **own complete stack** (`contracts/script/Deploy.s.sol` — every contract is `new`, every setter targets a contract from the same run; the only external address is Pyth's public Base Sepolia contract, read-only);
- deploys its **own x402 FeeRouter** (`DeployX402Router.s.sol`);
- uses **fresh keys** that have never owned an original-project contract, and never sends a transaction to an original-project address;
- does not reuse the original project's Vercel projects, signal-api, or keeper.

The fresh deployment landed on 2026-09-23 (below). `addresses.ts` now lists only this repo's contracts for Base Sepolia; every Base Sepolia contract this repo did not deploy is `0x0` (UI "not deployed" guard), and Ethereum Sepolia — which only ever held original-project contracts — is removed from `CHAIN_MAP`, so the UI and the agent treat it as unsupported.

## Known issues inherited from the original repo — decisions (2026-09-23)

| # | Issue | Decision | Status |
|---|---|---|---|
| 1 | README says the deployed exchange has `FUNDING_INTERVAL = 300` s (≈216%/day at the 0.75% cap) | Resolved by the fresh deployment: this repo's exchange is compiled from current source (`8 hours`). After deploying, read `FUNDING_INTERVAL()` on-chain and record it below. (For reference: the original project's current exchange `0x827e…124D` already reads 28800 on-chain; the 300 s figure described an older exchange.) | ✅ on-chain `FUNDING_INTERVAL()` = **28800** |
| 2 | Old `AgentSessionManager 0x5Ebcc64C…` still authorized, no per-session asset whitelist | Resolved by the fresh deployment: the new exchange only ever authorizes this repo's own session manager. After deploying, read `authorizedAgents()` for both old managers and record `false` below. (Original project: both old managers already read `false` on its current exchange.) | ✅ on-chain `authorizedAgents`: `0x5Ebcc64C…` false · `0x4E7cC1B7…` false · `0xdF9C1E53…` false · own manager `0x71125e25…` **true** |
| 3 | README numbers/addresses must match `addresses.ts` | README contract table regenerated from `addresses.ts` | ✅ done |
| 4 | Imported scheduled workflows have no secrets and would fail every 15 min | Disabled in this repo: Admin — Base Sepolia owner call, Base Sepolia Keeper, Oracle Health, Oracle Price Keeper (Sepolia), x402 Settlement Worker. Kept: Contracts CI, Agent CI, Frontend CI. The keeper is re-enabled only after it is pointed at this repo's own MockOracle with this repo's own keeper key. | ✅ done |

## This repo's Base Sepolia deployment (2026-09-23)

Deployer / owner: `0xB98BA27B606ae062CCC80071E5b9F81238DB3a02` (fresh key, never owned an original-project contract). Broadcast records: `contracts/broadcast/Deploy.s.sol/84532/run-1790157165167.json` and `contracts/broadcast/DeployX402Router.s.sol/84532/`. All 36 transactions succeeded; every non-create call targeted a contract created in the same run.

| Contract | Address |
|---|---|
| PerpetualExchange | `0xC45dEd77F4A30658e3c52E6fB4809E502e3D3B0E` |
| AgentSessionManager | `0x71125e25c903AD4e198e1863d5Bf26df97926CDe` |
| MockUSDC (margin, 18-dec) | `0x0910e965B06845BD3871860d522952a44a574058` |
| MockOracle | `0x7c7FD43376738151a09719Ab5B33962a77dfBb49` |
| InsuranceVault | `0x42b9503E4AEf7A347DB75E54d32230720D1dd4f0` |
| FeeRouter | `0x91E4aC532201Fc67C715Aa202B6Fe85F51b34994` |
| TraderStake | `0x790fd51ad485013C5b87FD7765679461675A31FD` |
| StrategyRegistry | `0x6Af6BEBC8fF0CE354e6E8A97921E1C5Ea95a7DE8` |
| CopyTracker | `0xF19E53dDBbD6CfDFb50deF952CA5f956ed08d0C4` |
| KYCRegistry | `0x34D644b9d58c1D4B0Cb805BA49440F53Ca0378d0` |
| MockSwapRouter | `0xCebdae595260F31541E44FBFfC80614d8B73C87a` |
| ChainlinkAdapter / PythAdapter / AggregatorOracle (showcase) | `0xb51Ab689…964A` / `0x2879d41C…71Fd` / `0xE5903f15…3444` |
| x402 FeeRouter (Circle USDC, treasury = seller `0xB4a1…e7b2`) | `0xEeDcEE7cD62A644EA4Cf053f213d5D75dB0B49c6` |
| x402 InsuranceVault | `0xb627510a0fe107E91235b56d88256Dc6526f0804` |

Verified on-chain after deploy: exchange owner = deployer; exchange oracle / usdc / feeRouter / insuranceVault and SessionManager.exchange, FeeRouter.exchange, InsuranceVault.exchange all point at this repo's contracts; the original project's FeeRouter still points at its own exchange (untouched).

### Post-deploy operations (2026-09-23, this repo's contracts only)

| Change | Why | Tx |
|---|---|---|
| `AggregatorOracle.setAllowSingleSource(true)` | Chainlink has no feed for these assets on Base Sepolia; allow Pyth-only | `0x92b66fda…` |
| `MockOracle.addAsset` × 7 (sNVDA, sMSFT, sGOOGL, sGOLD, sBOND, sICLN, sESGU) at live prices | Deploy.s.sol registered only 4 assets, so the keeper failed 7/11 writes | 7 txs |
| `MockOracle.transferOwnership` → keeper `0x3649247f6C7BBA2Dc9c4E88Cc24d0728d3203e95` | the GitHub `KEEPER_PRIVATE_KEY` secret must not be the exchange owner | `0x20e776fc…` |
| `PerpetualExchange.setExecutionFee(1e13)` (0.00001 ETH; contract default 0.001 ETH) | at ~0.011 gwei the default fee was ~200× the gas it is meant to cover | `0x3694dcb0…` |

**Pyth relay caveat:** Pyth on Base Sepolia is pull-based and its sBTC/sETH prices were ~13 days old on 2026-09-23 (`PriceIsStale`, threshold 1 h), so the keeper currently falls back to CoinGecko/Yahoo for every asset. Do not claim live Pyth pricing in the submission unless a Hermes price-update push is added.

The Base Sepolia Keeper workflow runs with the keeper key (GitHub secrets `KEEPER_PRIVATE_KEY`, `BASE_SEPOLIA_RPC_URL`); first run 2026-09-23 11:19 UTC succeeded.

### Spend Permission funder (2026-09-24, with the owner's approval)

| Change | Why | Tx |
|---|---|---|
| Deploy `SpendPermissionMarginFunder` at `0x20277169a755C690b98F0894EF57AF835469C9Af` (`script/DeploySpendPermissionFunder.s.sol`) | Base Accounts fund agent margin through Base Spend Permissions | `0x5f6ecfa0…` |
| `PerpetualExchange.setAgentAuthorized(funder, true)` | `depositMarginFor` only accepts authorized contracts. The exchange now trusts three contracts to act for users: AgentSessionManager, CopyTracker, and this funder, which only calls `depositMarginFor` | `0x4d07412c…` |

Source: Sourcify exact match and Blockscout full match. End-to-end run from a Base Account: [`demo/SPEND_PERMISSIONS_RUN.md`](demo/SPEND_PERMISSIONS_RUN.md).

## End-to-end demo (P0-3)

`agent/examples/e2e-demo.ts` replays the full story with three separate keys and writes [`demo/RUN.md`](demo/RUN.md). Latest run (session #2): user deposits and opens a capped session → signs the EIP-712 VC → agent buys data and a trader signal over x402 (Circle USDC to the seller) → seller routes the signal fee 70/20/10 on chain → agent opens inside the caps → an over-cap order is **mined and reverted** with `MarginExceedsPerTradeCap` → agent closes → user revokes → a post-revoke order is **mined and reverted** with `SessionIsRevoked`.

The demo surfaced an SDK bug, fixed here: `AGENT_SESSION_MANAGER_ABI` lacked the `SessionOpenedPosition` event, so `openPositionForSession` always returned `positionId: undefined` (and so did the MCP `open_position` tool).

## CI baseline at import (local run, 2026-09-23)
- Agent CI: install / typecheck / tests / bundle drift check — all pass
- Frontend CI: install / build / tests — all pass (33 files, 494 tests at import; 39 files, 535 tests after the Base Account work of 2026-09-24; 39 files, 562 tests after the review fixes of 2026-09-29)
- Contracts CI: `forge build --sizes` + `forge test` — all pass (2026-09-24, run 35967351546: 80 suites, 773 tests; forge 1.8 counts the six invariants of `AgentSessionInvariantTest` as one test)

Nothing was broken at import, so P0-1 needed no code fixes.
