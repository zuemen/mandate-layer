# Mandate Layer — bounded AI agents for on-chain derivatives

**One line:** a user gives an AI agent a trading mandate — per-trade margin, total budget, max leverage, allowed assets, expiry — and a contract on Base enforces it on every order, while the agent pays for its market data per call over x402.

Colosseum Crypto World's Fair · Base track · repo `zuemen/mandate-layer` · all contracts on **Base Sepolia (84532)**.

**Live, no wallet needed:** https://zuemen.github.io/mandate-layer/agent-mode

**Development history:** Mandate Layer started on 2026-05-05 as our NCCU capstone project, then called PepeLab, before this contest. Section 12 discloses the prior work and lists what we built during the contest (Sep 14 – Oct 12, 2026).

---

## 1. Problem

Agents can already sign trades. What they cannot get is a **bounded** mandate for derivatives:

- **Wallet-level permissions don't understand trades.** Coinbase Spend Permissions cap how much of one token a spender can pull per period ([docs](https://docs.cdp.coinbase.com/wallets/using-wallets/spend-permissions), read 2026-09-23). The CDP policy engine checks value, target, calldata, network and net USD change at signing time ([docs](https://docs.cdp.coinbase.com/server-wallets/v2/using-the-wallet-api/policies/overview)). Neither knows leverage, margin versus notional, which asset is traded, or cumulative exposure.
- **Venue-level agent keys are all-or-nothing.** Hyperliquid API wallets can place and cancel orders but not withdraw; the docs describe no per-agent size, leverage or asset limits ([docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets), read 2026-09-23). GMX One-Click Trading limits a subaccount by action count and expiry only ([docs](https://docs.gmx.io/docs/trading/v2/)).
- **Human-in-the-loop defeats autonomy.** In the Base MCP integration of Avantis, every action needs the user's sign-off in the Base App ([Crypto Briefing, 2026-06-09](https://cryptobriefing.com/avantis-base-mcp-ai-perpetual-trading/)).
- **Agents have no native way to buy the data they trade on**, and no auditable record tying a trade to who authorized it.

## 2. Solution

Three pieces, each usable on its own:

| Piece | What it does | Where |
|---|---|---|
| **AgentSessionManager** | The user opens a session for one agent address: `maxMarginPerTrade`, `totalMarginBudget` (cumulative), `maxLeverage`, `expiry`, and an asset allow-list. Every `openPositionForSession` is checked on chain; `revokeSession` stops the agent at once. The agent can only close positions its own session opened. | `contracts/src/AgentSessionManager.sol` |
| **Authorization VC** | The user signs a W3C Verifiable Credential (EIP-712, `did:pkh`) naming the agent, session and caps. The agent SDK verifies the signature **and** cross-checks every cap against the on-chain session before sending, so the off-chain credential and the on-chain mandate cannot drift. | `frontend/src/contracts/agentAuth.ts`, `agent/shared/src/identity.ts` |
| **x402 signal API** | Pay-per-call HTTP endpoints (`/oracle/:asset` 0.005 USDC, `/signals/:trader` 0.01 USDC). The agent gets HTTP 402, signs an EIP-3009 Circle USDC authorization, and retries. Signal fees can be routed on chain 70/20/10 (trader / platform / vault) through a FeeRouter. | `agent/signal-api` |

Agents drive all of it through an **MCP server** (`agent/mcp-server`: read tools plus `open_position` / `close_position` through the session) or the TypeScript SDK (`agent/shared`).

## 3. Proof: the replayable demo

`agent/examples/e2e-demo.ts` runs the whole story with **three separate keys** (User, Agent, Seller) in eight steps. The x402 payments are signed by the agent and submitted by the x402 facilitator. Latest run: [`demo/RUN.md`](../demo/RUN.md). Every on-chain step links to BaseScan; step ② is an off-chain signature.

| # | Actor | Step | On chain |
|---|---|---|---|
| ① | User | deposit margin, open session: 50 mUSDC per trade, 150 budget, 3x, sBTC/sETH, 7 days | tx |
| ② | User | sign the EIP-712 authorization VC | off-chain |
| ③ | Agent | buy market data and a trader's signal over x402 → Circle USDC to the seller | 2 txs |
| ③c | Seller | route the 0.01 USDC signal fee 70/20/10 → the trader accrues 0.007 USDC | tx |
| ④ | Agent | open sBTC long, 20 margin, 2x, through the session | tx |
| ⑤ | Agent | try 80 margin (cap 50) → **mined and reverted: `MarginExceedsPerTradeCap`** | tx (status 0) |
| ⑥ | Agent | close through the session | tx |
| ⑦ | User | revoke | tx |
| ⑧ | Agent | try again inside the caps → **mined and reverted: `SessionIsRevoked`** | tx (status 0) |

Steps ⑤ and ⑧ are sent with an explicit gas limit on purpose: the SDK would refuse them locally, which proves nothing. Forcing them on chain shows the **contract** is the enforcement point.

**Agent Mode page (`/agent-mode`)** — for judges, no wallet needed. It reads x402 payments, session caps and agent actions straight from chain, replays the recorded run with its rejected transactions, and has a **"try it" button** that simulates an over-cap or off-list order from a live session's agent with `eth_call`. What you see is the contract's own revert (`MarginExceedsPerTradeCap`, `AssetNotAllowed`).

## 4. Architecture

```mermaid
flowchart LR
  subgraph User
    W[Wallet] -->|createSessionWithAssets / revokeSession| ASM
    W -->|signs EIP-712 VC| VC[(Authorization VC<br/>did:pkh)]
  end
  subgraph Agent
    A[LLM agent / MCP client] -->|HTTP 402 + EIP-3009 USDC| API[x402 signal API]
    A -->|verify VC + cross-check caps| SDK[agent SDK / MCP server]
    SDK -->|openPositionForSession<br/>closePositionForSession| ASM
  end
  subgraph Base Sepolia
    ASM[AgentSessionManager<br/>caps · allow-list · expiry · revoke] -->|openPositionFor| EX[PerpetualExchange]
    EX --> IV[InsuranceVault]
    EX --> FR[FeeRouter 70/20/10]
    OR[MockOracle ← keeper] --> EX
    API -->|USDC to seller| S[Seller]
    S -->|routeExternalRevenue| XFR[x402 FeeRouter]
  end
  VC -. read by .-> SDK
```

## 5. Base integration

**Shipped (verifiable on Base Sepolia):**

- Every contract is deployed on Base Sepolia. The exchange lets two contracts act for a user: the AgentSessionManager (agents, within the session's limits) and the CopyTracker (copy trading, which each follower opts into). An agent's own key has no rights on the exchange.
- x402 payments settle in **Circle's official Base Sepolia USDC** (`0x036CbD53…CF7e`, EIP-3009 `transferWithAuthorization`) through the x402 facilitator. Each payment is an on-chain USDC transfer from agent to seller.
- Signal revenue is split on chain by a FeeRouter bound to that same USDC (`routeExternalRevenue`).
- **Base Account + Base Spend Permissions, live (added 2026-09-24).** A Base Account (Coinbase Smart Wallet) approves a Spend Permission through Coinbase's SpendPermissionManager (at most 100 mUSDC per day, only to our `SpendPermissionMarginFunder` [`0x2027…C9Af`](https://base-sepolia.blockscout.com/address/0x20277169a755C690b98F0894EF57AF835469C9Af?tab=contract)), names the agent, and opens the capped session, in one batch. The agent tops up the account's margin within the allowance; a top-up over the allowance is mined and reverted by SpendPermissionManager; the agent then trades inside the session caps with a credential the Base Account signed (ERC-1271). Recorded run with every transaction: [`demo/SPEND_PERMISSIONS_RUN.md`](../demo/SPEND_PERMISSIONS_RUN.md). The Spend Permission bounds how much can leave the wallet per day; the session bounds what the agent does with it. Design and trade-offs: [`docs/design/SPEND_PERMISSIONS.md`](design/SPEND_PERMISSIONS.md).
- **In the app: set it up from a Base Account.** The Sessions page has a card that sends the same batch through the wallet (EIP-5792 `wallet_sendCalls`, atomic), adding SpendPermissionManager as an owner first if a deployed account lacks it; the session's credential is then signed from the list. If the wallet creates a new account without SpendPermissionManager as an owner, the card notices after the batch and offers a one-call fix, with no second session. A test pins the calldata byte for byte to the batch that ran on chain. A browser test drives the deployed page on a Base Sepolia fork with a mock wallet that behaves like a Coinbase Smart Wallet, in four scenarios: an existing Base Account (22/22 checks), a new one that lacks SpendPermissionManager as an owner (22/22), one the wallet creates inside the batch without it (30/30: before the fix the agent's top-up is refused by the account, after it the top-up works), and a wallet rejection (9/9). The checks include the agent topping up margin with the exact permission the page shows and the agent's verifier accepting the credential ([`demo/BASE_ACCOUNT_UI_E2E.md`](../demo/BASE_ACCOUNT_UI_E2E.md)). Not yet tried with a real Base Account popup.
- The price keeper runs on GitHub Actions against this deployment. Oracle adapters for Pyth and Chainlink on Base Sepolia are deployed (see limitations).

**Planned (not in this submission):**

- List the signal API in **x402 Bazaar**, the CDP facilitator's service catalog ([docs](https://docs.cdp.coinbase.com/x402/bazaar)).
- **Paymaster**-sponsored session creation, so a user needs no ETH to delegate.
- A small Base mainnet deployment of the x402 layer only (risk review first; see Roadmap).

## 6. Contract addresses (Base Sepolia)

Source of truth: `frontend/src/contracts/addresses.ts`. Deployment details and on-chain checks: [`HACKATHON.md`](../HACKATHON.md).

| Contract | Address |
|---|---|
| PerpetualExchange | [`0xC45dEd77F4A30658e3c52E6fB4809E502e3D3B0E`](https://base-sepolia.blockscout.com/address/0xC45dEd77F4A30658e3c52E6fB4809E502e3D3B0E?tab=contract) |
| AgentSessionManager | [`0x71125e25c903AD4e198e1863d5Bf26df97926CDe`](https://base-sepolia.blockscout.com/address/0x71125e25c903AD4e198e1863d5Bf26df97926CDe?tab=contract) |
| x402 FeeRouter (Circle USDC) | [`0xEeDcEE7cD62A644EA4Cf053f213d5D75dB0B49c6`](https://base-sepolia.blockscout.com/address/0xEeDcEE7cD62A644EA4Cf053f213d5D75dB0B49c6?tab=contract) |
| FeeRouter (perp fees) | [`0x91E4aC532201Fc67C715Aa202B6Fe85F51b34994`](https://base-sepolia.blockscout.com/address/0x91E4aC532201Fc67C715Aa202B6Fe85F51b34994?tab=contract) |
| InsuranceVault | [`0x42b9503E4AEf7A347DB75E54d32230720D1dd4f0`](https://base-sepolia.blockscout.com/address/0x42b9503E4AEf7A347DB75E54d32230720D1dd4f0?tab=contract) |
| MockOracle | [`0x7c7FD43376738151a09719Ab5B33962a77dfBb49`](https://base-sepolia.blockscout.com/address/0x7c7FD43376738151a09719Ab5B33962a77dfBb49?tab=contract) |
| MockUSDC (margin) | [`0x0910e965B06845BD3871860d522952a44a574058`](https://base-sepolia.blockscout.com/address/0x0910e965B06845BD3871860d522952a44a574058?tab=contract) |
| CopyTracker | [`0xF19E53dDBbD6CfDFb50deF952CA5f956ed08d0C4`](https://base-sepolia.blockscout.com/address/0xF19E53dDBbD6CfDFb50deF952CA5f956ed08d0C4?tab=contract) |
| StrategyRegistry | [`0x6Af6BEBC8fF0CE354e6E8A97921E1C5Ea95a7DE8`](https://base-sepolia.blockscout.com/address/0x6Af6BEBC8fF0CE354e6E8A97921E1C5Ea95a7DE8?tab=contract) |
| KYCRegistry | [`0x34D644b9d58c1D4B0Cb805BA49440F53Ca0378d0`](https://base-sepolia.blockscout.com/address/0x34D644b9d58c1D4B0Cb805BA49440F53Ca0378d0?tab=contract) |
| TraderStake | [`0x790fd51ad485013C5b87FD7765679461675A31FD`](https://base-sepolia.blockscout.com/address/0x790fd51ad485013C5b87FD7765679461675A31FD?tab=contract) |
| MockSwapRouter | [`0xCebdae595260F31541E44FBFfC80614d8B73C87a`](https://base-sepolia.blockscout.com/address/0xCebdae595260F31541E44FBFfC80614d8B73C87a?tab=contract) |
| SpendPermissionMarginFunder (Base Spend Permissions, 2026-09-24) | [`0x20277169a755C690b98F0894EF57AF835469C9Af`](https://base-sepolia.blockscout.com/address/0x20277169a755C690b98F0894EF57AF835469C9Af?tab=contract) |

Source code for all 16 contracts of the 2026-09-23 deployment (the table plus three oracle adapters and the x402 InsuranceVault) is verified on [Blockscout](https://base-sepolia.blockscout.com) and [Sourcify](https://sourcify.dev) as an exact match (creation and runtime bytecode), checked 2026-09-24. The SpendPermissionMarginFunder added on 2026-09-24 is verified on both as well (Sourcify exact match; Blockscout full match, checked 2026-09-24). Click an address to read the code.

Judge sandbox: session **#3** (agent `0xd3c6a11e…0EB7`, 50 per trade, 150 budget, 3x, sBTC/sETH; created 2026-09-23, tx `0xc3d6d00f…4336`) stays active until 2026-12-12. The Agent Mode "try it" button uses the newest active session, which is #3 unless a newer one is opened.

## 7. Run it locally

```bash
# contracts
cd contracts && forge test            # 773 tests in CI on 2026-09-24

# agent: signal API, then the three-party demo
cd agent && npm ci
cp .env.example .env                   # addresses already point at this deployment
npm run signal-api                     # http://localhost:4021
USER_PRIVATE_KEY=0x… AGENT_PRIVATE_KEY=0x… SELLER_PRIVATE_KEY=0x… \
  npx tsx examples/e2e-demo.ts         # writes demo/RUN.md

# frontend
cd frontend && yarn install --frozen-lockfile
VITE_LOCALE=en yarn dev                # open /agent-mode
```

Test keys need Base Sepolia ETH. The agent key also needs Circle test USDC from faucet.circle.com. The user gets margin from `MockUSDC.faucet()`.

## 8. Business model

| Revenue line | Mechanism | Already on chain? |
|---|---|---|
| Signal and data fees | Agents pay per call over x402. Strategy providers set a price and keep 70%; 20% platform; 10% insurance vault | Yes: `routeExternalRevenue` |
| Trading fees | A share of every perp trading fee funds the insurance vault; copy-trading performance fees are split 70/20/10 by the perp FeeRouter | Yes: exchange and FeeRouter |
| Mandate infrastructure (B2B) | Agent builders and wallets license the session and VC layer to offer "bounded autonomy" on their own venue | Roadmap |

**Who pays**

- **Agent developers** want to ship a trading agent their users can safely fund.
- **Quant and strategy providers** want to sell signals to machines, with on-chain proof of performance and automatic revenue share.
- **Retail users** want to delegate without handing over a key.

**Why x402 plus a VC mandate is the wedge**

x402 turns data into something an agent can buy without accounts or API keys. The mandate turns "the agent may trade" into a precise, revocable, auditable contract. Every order can be traced to a user signature (the VC), an on-chain session, and the paid inputs the agent used. Hyperliquid, GMX and Spend Permissions each cover a part of this; none enforces trade-level limits on chain.

**Market context** (third-party, dated):

- On-chain perp DEX volume was $593.3B over 30 days (DefiLlama via [CoinLaw, 2026-09-09](https://coinlaw.io/perpetual-futures-statistics/)).
- Hyperliquid alone did $239.2B over 30 days ([The Crypto Times, 2026-09-17](https://www.cryptotimes.io/2026/09/17/hyperliquid-leads-30-day-perpetual-volume-with-nearly-240b/)).
- Perp volume on Base was $3.1B over 30 days (DefiLlama via The Crypto Times, 2026-09-17; a different window from the CoinLaw figure). That is a small base with room to grow for agent-driven flow.
- x402 is an open standard governed by the x402 Foundation under the Linux Foundation since 2026-07-14 ([LF](https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications)). Artemis estimates that most of its current traffic is protocol signaling rather than commerce ([Forkast, 2026-08-04](https://finance.yahoo.com/markets/crypto/articles/x402-foundation-activated-27-old-152440828.html)). Paid machine-to-machine data is early; that is the opportunity, not a claim of traction.

### Go-to-market and distribution

Colosseum asks for go-to-market, demand validation and distribution. Facts and hypotheses are marked separately.

**First customers (hypothesis).** Teams that already ship trading agents and need their users to fund them safely, and trading venues on Base that want agent flow without handing out all-or-nothing keys. Both would buy bounded autonomy as infrastructure, which is why licensing the mandate layer (B2B) is our main bet.

**How they find us.**

1. **Open source first (fact).** The session contract, the agent SDK and the MCP server are MIT-licensed, with verified source on Base Sepolia. Any agent can use them on testnet today.
2. **Agent-native discovery.** The MCP server works with MCP-capable agent frameworks today. Listing the data API on x402 Bazaar needs a publicly hosted signal API first (planned).
3. **Direct outreach.** Agent builders, trading teams on Base, and data sellers, through the Base and agent-builder communities.

**What we charge (hypotheses, not yet validated).** Data and signals: per call over x402 at a price the provider sets; the 20% platform and 10% vault shares are already routed on chain. Mandate layer: a license per venue or per active session.

**Demand validation.** Until October 12 we interview agent builders, trading teams on Base and data sellers with a fixed script (their past behaviour first, our product last) and record every conversation. Validation so far: none recorded yet (as of 2026-09-29). We will update this line with real numbers only.

## 9. Competitive landscape

| | Per-trade size cap | Leverage cap | Asset allow-list | Revocable | Agent pays for data | Enforced where |
|---|---|---|---|---|---|---|
| Hyperliquid API wallet | — | — | — | deregister | — | venue (key scope only) |
| GMX One-Click Trading | — | — | — | expiry / action count | — | venue |
| Base Spend Permissions | token allowance per period | — | — | yes | — | wallet |
| Avantis via Base MCP | user signs each action | — | — | n/a | — | human |
| **Mandate Layer session + VC** | **yes** | **yes** | **yes** | **yes** | **x402** | **contract** |

Sources: see §1 (read 2026-09-23). A dash means the source documents no such control.

## 10. Roadmap

1. **Venue-agnostic mandates.** Move the session checks into a guard any perp venue on Base can call before `openPositionFor`. Our exchange becomes the reference venue.
2. **Base-native stack.** Spend Permissions for the cash leg are live on Base Sepolia, with an in-app setup from a Base Account (§5); next, a run with a real Base Account popup, Paymaster-sponsored delegation; x402 Bazaar listing; an ERC-8004 identity entry for each agent (the standard is still a Draft: [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)).
3. **Net-exposure budgets.** Today `totalMarginBudget` is cumulative: closing does not refund budget. That is conservative by design. Add an optional net-exposure mode.
4. **Decentralized pricing.** The oracle adapters are deployed. Pyth on Base Sepolia is pull-based and was stale when we checked, so the next step is to push Hermes price updates from the keeper before relying on it.
5. **Institutional agents (vLEI).** A fund or corporate treasury should be able to prove which regulated legal entity authorized an agent, and which officer signed. GLEIF's vLEI carries exactly that: a Legal Entity credential plus an Official Organizational Role (OOR) credential for the signer ([GLEIF](https://www.gleif.org/en/organizational-identity/lei-vlei/the-verifiable-lei-vlei)). Our authorization VC would add an OOR-backed issuer, and `KYCRegistry` would accept vLEI-verified entities. That opens RWA and institutional flow, where "who authorized this agent" is a compliance requirement rather than a nice-to-have. GLEIF has published work on agent delegation ([blog, 2026-08-25](https://www.gleif.org/en/newsroom/blog/why-ai-agents-need-verifiable-organizational-identity)). This is a roadmap item, not part of this submission.

## 11. Current state and limitations

| Area | Today | Plan |
|---|---|---|
| Network | Base Sepolia only; margin token is MockUSDC | Mainnet for the x402 layer first, after a risk review |
| Prices | MockOracle fed by a keeper (CoinGecko / Yahoo). The keeper key can write any value. Pyth relay deployed but stale on testnet | Pyth Hermes push, then the aggregator as primary |
| Budget semantics | Cumulative spend; closing does not refund budget | Optional net-exposure mode |
| Revenue routing | The x402 payment and the 70/20/10 routing are two transactions; routing is done by the seller | Atomic routing at the payee |
| VC | Standing authorization without a nonce. Revocation is the on-chain `revokeSession` | Status list and nonce |
| Liquidation | The remaining collateral goes to the liquidator and the vault, not back to the owner | Refund the remainder |

Security history: [`docs/audit/AUDIT_2026-08-06.md`](audit/AUDIT_2026-08-06.md). Every session limit is covered by invariant fuzzing ([`contracts/test/AgentSessionInvariant.t.sol`](../contracts/test/AgentSessionInvariant.t.sol)); removing any one of the seven checks makes an invariant fail (checked 2026-09-24). This deployment uses fresh keys; a historical key visible in git history owns nothing here.

## 12. Development history and disclosure

**This product was not started at the hackathon.** It began on 2026-05-05 as our NCCU Capstone 2026 project under the name PepeLab; we renamed it Mandate Layer for this submission on 2026-09-29 (the repository was `zuemen/pepelab-colosseum` until then). The git history, the EIP-712 domain names (`PepeLabAgentAuthorization`, `PepeLabAgentVerification`) and some code identifiers (`pepefi`, `pepelab_*`) keep the old name: changing them would invalidate signed credentials. The repository keeps its full git history: 624 commits before the contest opened (Sep 14, 2026, 06:00 PT) and 88 during it so far (75 authored commits and 13 GitHub merge commits, as of Sep 29, 2026). Net change since the last pre-contest commit (`3118824`): 203 files, +9,987 / −5,058 lines, not counting generated deployment records under `contracts/broadcast`. Colosseum judges only the work done during the contest, so this section separates the two. Every hash below is in this repository.

### Prior work (before Sep 14, 2026)

| Component | First commit |
|---|---|
| `PerpetualExchange` (on-chain CFD/perpetuals engine), MockUSDC, oracle adapters | `307765e`, 2026-05-06 |
| `FeeRouter` (fee routing; later the 70/20/10 x402 revenue split) | `907a6b6`, 2026-05-09 |
| `AgentSessionManager` (per-trade cap, budget, max leverage, expiry, revocation) | `f7a1308`, 2026-06-13 |
| Per-session asset allow-list | `d4d6d58`, 2026-07-27 |
| Frontend: session UI, x402 developer docs page, landing KPI strip | `3bf29b2` (06-13), `ca9b80f` (06-15), `cbadf67` (06-16) |
| Agent stack: x402 signal API, MCP server, demo agent, shared SDK | `5585f28`, 2026-06-13 |
| EIP-712 agent-authorization credential (issue and verify) | `18ab803`, `a9c695d`, 2026-06-19 |
| Telegram bot | `9eb6697`, 2026-06-21 |
| Security review and fixes | [`docs/audit/AUDIT_2026-08-06.md`](audit/AUDIT_2026-08-06.md) |

The wider capstone app (marketplace, vaults, staking, ESG and carbon features) also predates the contest. It is not what this submission pitches.

### Built during the contest (Sep 14 – Oct 12, 2026)

| Work | Commits |
|---|---|
| **Isolated deployment for judges.** A fresh, complete contract stack on Base Sepolia with new keys, including our own x402 FeeRouter bound to Circle USDC. Repo references, ops scripts and the price keeper now point only at it. | `5bb8be3`, `a5305e0`, `4b7533a`, `da66374`, `c9e2f64`, `090407a` |
| **Replayable three-party demo.** User, agent and signal seller on separate keys; two orders mined and reverted by the contract (over the cap, after revocation). Fixed an SDK bug where `open_position` returned no position id. | `be98b00` |
| **Agent Mode page.** A wallet-free judge view of agent payments, session caps and rejections, with "Try it" simulations against the live contract. | `ed3f531`, `e552317` |
| **Open, English, public packaging.** English README and submission, MIT license, English MCP and signal-API discovery text, English frontend on GitHub Pages. | `7d7523c`, `d888ab9`, `bb6f840`, `29dd595`, `109f3a6`, `7556c3b` |
| **x402 signal API hardening.** Record revenue only after the facilitator confirms settlement, then settle in batches from a queue (this also fixed routing revenue for payments that never settled); facilitator latency probe; explicit payment timeouts; facilitator error handling; written threat model for credentials passed as tool arguments. | `c738cb3`, `de46da8` |
| **Base Account + Spend Permissions.** `SpendPermissionMarginFunder` (8 fork tests against Base Sepolia's real SpendPermissionManager and Coinbase Smart Wallet factory), deployed and authorized on Base Sepolia; agent SDK and MCP `top_up_margin`; authorization credentials signed by smart accounts (ERC-1271), accepted by every agent entry point; an end-to-end run from a Base Account; the in-app setup card on the Sessions page with a fork browser test; review fixes to the card (a one-call fix for a new account created without SpendPermissionManager as an owner, wallet error handling, no status flicker) with a fourth browser-test scenario. | `1f38197`, `c72b8e7`, `0035d44`, `b3b48bf`, `ee6c161`, `6deca42`, `8e4fdf7`, `7eea7fe`, `0cd77a4`, `d70247f`, `886ab7f`, `1cfa0f3`, `5a61953`, `830f2f5`, `94d2225`; deploy tx `0x5f6ecfa0…`, authorize tx `0x4d07412c…` |
| **Reliability fixes found while preparing the demo.** Event scans under the 1,000-block `eth_getLogs` cap of sepolia.base.org; keeper nonce reuse on a lagging load-balanced RPC. | `6da5d42`, `9e5340c` |
| **Retail app work (not the focus of this submission).** Adopt a published allocation as spot tokens, swap-only exchange page, portfolio and token page polish, reputation staking, ESG carbon-tier display. | `ac3e2a0`, `b4b2c22`, `fa7dbe0`, `7c830b9`, `155b3dd`, `8219a0b`, `043f9ca` |

### How we prioritized

The first week of the contest went to the retail app, before we committed to this submission. The capstone already had the contracts; what it lacked was evidence a stranger could check without trusting us. Once we chose the Base track, we put that first: an isolated deployment, a demo whose rejected orders are real reverted transactions, and a page that shows them without a wallet. Packaging and reliability fixes came next, because a judge who hits a 404 or an empty page never reaches the idea.

## 13. Team

**NewJeans always five** — National Chengchi University (NCCU), Taipei, Taiwan. All three of us are NCCU Management Information Systems undergraduates.

| Member | Role | Background |
|---|---|---|
| Ting-Yi (Zuemen) Chu | Founder, lead developer: smart contracts, agent SDK and MCP server, frontend | Research assistant on smart-contract security and on AI + quantum computing at NCCU. Led ChainLens (FinTech Taipei Awards 2026 finalist); Merit Award, Ministry of Digital Affairs Digital Credential Scenario Innovation Challenge (2025). |
| Wang Lei | Market researcher and analyst | Advertising, graphic design, data analysis and marketing. |
| Ko Ying-Wen | Engineer, trading systems | Built a perpetual-futures trading bot with a daily-loss circuit breaker and a live commercial booking system; co-author of a paper accepted at AMCIS 2026. |

How we found the problem: we built an on-chain perpetuals exchange as our capstone and wanted AI agents to trade on it. The only options were handing an agent our key or approving every order, so we made the mandate a signed credential and the limits a rule the contract checks.

## AI usage

We build with an AI coding assistant (Claude Code). Commits it co-wrote carry a `Co-Authored-By: Claude` trailer. As of Sep 29, 2026, all 76 authored commits of the contest period carry it; the other 13 contest-period commits are GitHub merge commits. The product demo video was also produced with the assistant: a script drives the live site in a browser, and the narration is a synthetic voice.

| The assistant | The team |
|---|---|
| Wrote and refactored contracts, agent code, frontend pages and tests | Chose the product, the Base track and the positioning |
| Ran test suites, deployments and on-chain reads we asked for | Decided which features to build and in what order |
| Drafted documentation, including this write-up | Set the rules the work follows (for example, no writes to the capstone's contracts) and decided what shipped |
