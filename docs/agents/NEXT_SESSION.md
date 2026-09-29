# Next session: handoff (written 2026-09-25, updated 2026-09-29)

For an agent picking this repo up on a **different machine or in the cloud**. Everything needed is in this
repo; nothing depends on the previous machine. Work through the task table in order and append to the
progress log at the bottom as you go.

## Where things stand

- Branch `hackathon/colosseum-worldsfair` (the default branch). At hand-off the tree was clean and pushed, CI
  green, and the site live at <https://zuemen.github.io/mandate-layer> (GitHub Pages deploys on every push).
- Contest: Colosseum Crypto World's Fair, Base track. Deadline **2026-10-12 23:59 PT**. Only work done during the
  contest (from 2026-09-14) is judged, and earlier work must be disclosed. See `docs/SUBMISSION.md` §12.
- Finished on 2026-09-24:
  - The in-app Base Account setup card on the Sessions page (`frontend/src/components/pepefi/BaseAccountSetupCard.tsx`).
    It sends one EIP-5792 `wallet_sendCalls` batch. The batch optionally adds SpendPermissionManager (SPM) as an
    owner, then `SPM.approve(permission)`, then `funder.setTopUpAgent(agent)`, then `createSessionWithAssets`.
  - A browser E2E on a Base Sepolia fork: `demo/e2e/base_account_fork_e2e.py`, report `demo/BASE_ACCOUNT_UI_E2E.md`.
    Scenarios: `existing` 20/20, `fresh` 20/20, `reject` 8/8.
  - ERC-1271 (Base Account) credentials accepted at every agent entry point.
  - Avatars resized; docs synced.
- On 2026-09-25 two more reviews came back: R1, a fresh review of the fixes, and R2, research. Their findings are
  the task table below.
- **2026-09-29, evening: renamed PepeLab → Mandate Layer.** The repository is now `zuemen/mandate-layer` (site <https://zuemen.github.io/mandate-layer>); the old Pages URL returns 404. EIP-712 domain names and code identifiers keep the old name on purpose (SUBMISSION §12). The local checkout folder on the original machine is still `~/pepelab-colosseum`.
- **2026-09-29: tasks 1–9 are done**, followed by three more fresh-review rounds on the fixes (R3–R6; the last one
  found no new bug). Commits `886ab7f`, `1cfa0f3`, `5a61953`, `830f2f5`, `94d2225` and the docs commit after them.
  Frontend 39 files, 562 tests (CI green). Fork E2E against the deployed site at `94d2225`: `existing` 22/22,
  `fresh` 22/22, `undeployed` 30/30, `reject` 9/9 (`demo/BASE_ACCOUNT_UI_E2E.md`). The review reports are kept outside
  the repo, in the user's competition folder. Nothing was sent to Base Sepolia.

## Rules

1. **Isolation.** This repo is a contest-only import of `zuemen/pepelab_onchain_cfd`.
   - Never send a transaction to that project's contracts.
   - Never touch its services, keys or GitHub issues.
   - Only this repo's own deployment counts. Its addresses are in `frontend/src/contracts/addresses.ts`.
2. **No on-chain transactions** signed with a private key unless the user explicitly agrees in that session.
   - No private keys are on the new machine, and none of the tasks below need one.
   - Test on a local anvil fork. The E2E uses throwaway keys and anvil impersonation.
3. **Claims.** Never write that the card was tested with a *real* Base Account, unless the user did it and says
   so. Today it is "a mock wallet on a fork".
4. **Package managers.** `frontend/` uses yarn only (`yarn install --frozen-lockfile`); `agent/` uses npm only
   (`npm ci`). Do not add dependencies.
5. **Commit only after the checks pass.** Chain the commands with `set -e`, in this order: typecheck → tests →
   commit → push. A pushed type error breaks the Pages build. End each commit message with the co-author line the
   harness gives you.
6. **After fixing review findings,** have a *fresh* reviewer check only the fixes. Fixes introduced new problems
   twice already.
7. **Disclose contest work.** New contest-period work goes into `docs/SUBMISSION.md` §12 with its commit hashes.
8. **Times** in the progress log come from `date`, never estimates.

## Wallets and keys

**Private keys are not in git and not on the new machine.** None of the tasks below needs them.

On the previous machine, all keys are in one file: `~/.config/mandate-layer/.env`. That is the user's home
directory, outside the repo. The file holds:
- `BASE_SEPOLIA_RPC_URL`
- `DEPLOYER_`, `USER_`, `AGENT_`, `SELLER_`, `KEEPER_`, each as `…_ADDRESS` and `…_PRIVATE_KEY`

If a later task truly needs a key, it is always on-chain work, which also needs the user's explicit consent. In
that case:
1. The user copies the file by hand over a private channel. Never use chat, git, an issue or a shared doc.
2. On the new machine the file goes to the same path, `~/.config/mandate-layer/.env`. `agent/.env` also works:
   it is gitignored, and `agent/shared/src/env.ts` loads it.
3. Load it for one command with `set -a; . ~/.config/mandate-layer/.env; set +a`.
4. Never print, log or commit a value from it. If you find a plaintext key anywhere, report where it is and change
   nothing.

GitHub Actions secrets on this repo: `BASE_SEPOLIA_RPC_URL` and `KEEPER_PRIVATE_KEY`. The price keeper runs from
these.

Wallets on Base Sepolia (84532). Balances were read on 2026-09-25.

| Role | Address | What it is | ETH | mUSDC |
|---|---|---|---|---|
| Deployer / owner | `0xB98BA27B606ae062CCC80071E5b9F81238DB3a02` | owns the exchange, FeeRouter, vaults, AgentSessionManager and the funder | 0.00058 | 0 |
| Keeper | `0x3649247f6C7BBA2Dc9c4E88Cc24d0728d3203e95` | owns only MockOracle; its key is also the Actions secret | 0.00027 | 0 |
| User | `0x2F188C934ffFa25D2af8354eb18fAE65038F5467` | user of sessions #0–#3; owner index 0 of the Base Account below | 0.00028 | 100 |
| Agent | `0xd3c6a11ef5aF3D197Ecd0C9C44B15a23138d0EB7` | agent of every session; holds Circle USDC for x402 | 0.00014 | 0 |
| Signal seller | `0xB4a1EEF4bF5d3D7C8d9058f10A23f98D08f4e7b2` | x402 `payTo`, treasury of the x402 FeeRouter | 0.00010 | 0 |
| Base Account | `0x56D83fEe6cf6F0BFf345640C7527a1869677435F` | Coinbase Smart Wallet from the recorded run; owners are User and SPM; session #4 | 0 | 240 |

- The keeper burns about 0.00002 ETH a day and **runs out around Oct 7**. Topping it up from a Base Sepolia faucet is
  the user's job. The other wallets are also thin; top them up before any new on-chain run.
- Contracts that matter here:
  - SpendPermissionManager (Coinbase): `0xf85210B21cC50302F477BA56686d2019dC9b67Ad`
  - Coinbase Smart Wallet factory: `0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a`
  - SpendPermissionMarginFunder (ours): `0x20277169a755C690b98F0894EF57AF835469C9Af`
  - AgentSessionManager: `0x71125e25c903AD4e198e1863d5Bf26df97926CDe`
  - MockUSDC (18 decimals; `faucet()` works for EOAs only): `0x0910e965B06845BD3871860d522952a44a574058`
  - Everything else: `frontend/src/contracts/addresses.ts`.

## Setup

Full notes: `docs/agents/environment.md`.

```bash
git clone https://github.com/zuemen/mandate-layer && cd mandate-layer
(cd frontend && yarn install --frozen-lockfile)
(cd agent && npm ci)
pip install playwright eth-account && python -m playwright install chromium   # E2E only
# E2E also needs Foundry's anvil: https://book.getfoundry.sh/getting-started/installation
```

Checks (baseline at hand-off):

- Frontend: `cd frontend && npx tsc --noEmit -p . && npx vitest run` gives 39 files, 535 tests.
  - Use `tsc --noEmit -p .`, not `tsc -b`, which writes `.js` files next to the sources.
  - A local `vite build` may run out of memory on small machines; CI builds it.
- Agent: `cd agent && npx tsc -b && npm test`.
- Contracts: not touched by these tasks.

## Tasks, in priority order

**All done on 2026-09-29** (see the progress log); kept for the record. Line numbers are as of commit `1dc65b0`.

| # | Priority | Where | What to do |
|---|---|---|---|
| 1 | high | `frontend/src/components/pepefi/BaseAccountSetupCard.tsx` | **Remedy path for accounts that are not deployed yet.** R2 below found no primary source confirming that a new Base Account has SPM as an owner. When `code == 0x` the card sends the batch with `addSpmOwner = false`. If the wallet then deploys the account *without* SPM, the agent's `spend` fails later. After a confirmed batch the card already reads the account again. If it finds SPM is not an owner, show a warning and a button that sends a **single-call** `wallet_sendCalls` with `addOwnerAddress(SPM)` to the account itself; this must not open a new session. **Do not** put `addOwnerAddress` into the undeployed batch: if the wallet's initCode already includes SPM, `AlreadyOwner` reverts the whole atomic batch. Suggested: move send-and-poll (2.0.0 with a 1.0 fallback, then `wallet_getCallsStatus`) into one helper that both buttons use. Add en and zh-TW strings (`frontend/src/locales/{en,zh-TW}/sessions.ts`, block `baseAccount`). |
| 2 | high | `demo/e2e/base_account_fork_e2e.py` | **New `undeployed` scenario for the worst case.** Owners are `[throwaway]` only. `wallet_getCapabilities` answers `atomic: supported`. On `wallet_sendCalls` the mock first deploys the account through the factory (`createAccount([owner], nonce)`, without SPM), then sends `executeBatch`. Check: the card's "will be created by this batch" status; a 3-call batch; the remedy button appears and, once clicked, SPM is an owner; the agent's `funder.topUp` moves 5 mUSDC; the credential verifies (ERC-1271 and `agent/examples/verify-vc-file.ts`). |
| 3 | medium | `frontend/src/pages/pepefi/AgentModePage.tsx:379` | The "in the app" link goes to `/sessions`. That route is not in `PUBLIC_PATHS` (`frontend/src/layouts/pepefi/index.tsx:27`), so a visitor without a wallet (a judge) is redirected to `/` (`index.tsx:38-39`). Show the link only when `wallet.isConnected`; otherwise show plain text: "connect a wallet, then Agent Sessions". |
| 4 | medium | `frontend/src/lib/pepefi/walletCalls.ts:69-72` | `isVersionMismatch` still matches `/version/i` on the wallet's message, so an internal error or an SDK `TypeError` that mentions "version" triggers a 1.0 resend, which can mean a second popup. Fall back only when `code === -32602` and the message names `wallet_sendCalls`, `2.0.0` or a version. Add tests in `walletCalls.test.ts` (they run errors through a real ethers `BrowserProvider`). |
| 5 | medium-low | `BaseAccountSetupCard.tsx:188-192` and `:121-124` | `finally { setRecheck(...) }` makes the effect call `setKind('checking')`. The status then flashes "Checking…" and the button is disabled while a result is on screen. Keep the previous `kind` during a re-read, and set `checking` only on first load or when the address changes. Move the session-length check before the `try` and before any RPC call. |
| 6 | low | `BaseAccountSetupCard.tsx:70-72` | If `getCode` fails during a re-read, keep the last known `kind` instead of switching to `readFailed`, or give `readFailed` a Retry button that bumps `recheck`. |
| 7 | low | `walletCalls.ts:61` | `code === 'UNSUPPORTED_OPERATION'` also matches ethers' own "provider destroyed; cancelled request". Only treat it as unsupported when `e.info?.error` exists, meaning the error came from the wallet. |
| 8 | low | `demo/e2e/base_account_fork_e2e.py:297-303` | In `reject`, the "no session opened" check carries no information: the mock refuses before anything is sent. Drop or reword it, and keep `send_count == 1`. Record the tested commit in `result.json`, for example from the site's JS bundle hash or `git rev-parse HEAD`. |
| 9 | low | locale `sessions.baseAccount.badHours` (en and zh-TW) | The text says "a positive number", but the guard is `expiry > now + 60`. Make them agree. |

## After the tasks

1. Run the checks above. Wait until the Pages deploy for your last commit has finished
   (`gh run list --branch hackathon/colosseum-worldsfair`). Then run the E2E on a fork, all four scenarios:
   ```bash
   anvil --fork-url https://base-sepolia-rpc.publicnode.com --chain-id 84532 --block-time 1 &
   for s in existing fresh reject undeployed; do python demo/e2e/base_account_fork_e2e.py $s; done
   ```
   If anvil or Chromium cannot run here, say so in the report. Do not claim the E2E ran.
2. Have a fresh reviewer check only this batch of fixes. Verify each finding against the code, then fix it.
3. Update the repo docs:
   - `demo/BASE_ACCOUNT_UI_E2E.md`: scenario table, results, and the "what this does not show" list. The
     undeployed path becomes covered by the remedy button.
   - `docs/design/SPEND_PERMISSIONS.md`: open items.
   - `docs/SUBMISSION.md` §5 and §12: new commits.
   - `HACKATHON.md`: the frontend test count.
4. Material kept **outside this repo** (Chinese docs, the deck, video scripts, the form draft) sits in the user's
   local competition folder. If the user has provided that folder, update it:
   - Frontend test count in `04_說明書/_build/numbers.cjs` and `verify.py` line 18, then run `node build_all.cjs`
     and `python verify.py`.
   - Any Base Account wording that changed.

   Otherwise, list the needed changes in your final report instead.
5. Append to the progress log below. Give the user a final report in Traditional Chinese: what changed, the
   evidence (commits, test counts, E2E results), what was not done, and what they must do themselves.

Still for the user alone, not the agent:
- Top up the keeper wallet before about Oct 7.
- Optionally, press the card once with a real Base Account on Base Sepolia. After that, docs may say it was
  verified with a real Base Account.

## R2 research: sources for task 1

- The spend-permissions design handles both cases. When the account is not deployed and the manager is in its
  initCode, the signature is ERC-6492-wrapped. Otherwise the wallet frontend adds the manager as an owner:
  <https://github.com/coinbase/spend-permissions/blob/main/README.md>,
  <https://github.com/coinbase/spend-permissions/blob/main/docs/diagrams/signSpendPermission.md>.
- keys.coinbase.com is closed source. Whether new Base Accounts include SPM by default is **unconfirmed**.
- The CDP SDK adds SPM only when asked: `if (options.enableSpendPermissions) owners.push(SPEND_PERMISSION_MANAGER_ADDRESS)`
  (<https://github.com/coinbase/cdp-sdk/blob/main/typescript/packages/cdp-sdk/src/client/evm/evm.ts>).
- The Base Account SDK's `requestSpendPermission` signs with `eth_signTypedData_v4`. The spender submits it with
  `approveWithSignature`, which supports ERC-6492 and deploys the account
  (<https://github.com/base/account-sdk>, `packages/account-sdk/src/interface/public-utilities/spend-permission/`).
- `spend` runs through `CoinbaseSmartWallet(account).execute(...)`, so SPM **must** be an owner.

## Progress log

Append one line per step: `[date output] task # — status — evidence (commit, test counts) | next: …`

- [2026-09-25 09:57 (previous machine; its clock ran about 5h26m slow)] Handoff written; tasks 1–9 not started.
- [Tue Sep 29 09:16:33 2026] Picked up on the original machine (repo at `45af5dc`, clean; its clock now agrees with a Base Sepolia fork's block time). Tasks 1–9 started.
- [Tue Sep 29 09:45:41 2026] Tasks 1–9 done — `886ab7f` (card fix button, sendCallsAndWait, no status flicker, Retry, badHours, version/unsupported checks, Agent Mode link), `1cfa0f3` (E2E `undeployed`, no-flash check, reject cleanup, tested build); frontend 535 → 549 | next: Pages, E2E, fresh review.
- [Tue Sep 29 09:54:11 2026] E2E on the deployed site at `1cfa0f3`: existing 21/21, fresh 21/21, reject 8/8, undeployed 27/27. Fresh review R3: 3 medium, 3 low (fix not tied to the account, 1.0 fallback unreachable for MetaMask's -32000, a single post-batch read could hide the fix).
- [Tue Sep 29 10:06:00 2026] R3 fixes pushed — `5a61953`; frontend 555. E2E at `5a61953`: 21/21, 21/21, 8/8, 28/28.
- [Tue Sep 29 10:17:27 2026] Fresh review R4 of `5a61953`: F1/F2/F4/F5 fixed, F3/F6 partly; four new, all low.
- [Tue Sep 29 10:37:10 2026] R4 fixes pushed — `830f2f5` (one classifier for owner reads, pending fix and JSON kept in sessionStorage, build check against the frontend tree); frontend 561. E2E at `830f2f5`: 22/22, 22/22, 9/9, 30/30.
- [Tue Sep 29 10:45:08 2026] Fresh review R5 of `830f2f5`: R4 items fixed (N2 partly); four new, all low (two were regressions of `830f2f5`).
- [Tue Sep 29 10:50:51 2026] R5 fixes pushed — `94d2225`; frontend 562 (CI green). E2E at `94d2225`: existing 22/22, fresh 22/22, reject 9/9, undeployed 30/30.
- [Tue Sep 29 11:01:15 2026] Final narrow review R6 of `94d2225`: P1–P4 fixed, no new bug; one test-only gap (agent field empty after the reload) fixed in the E2E. Docs synced (E2E report, SPEND_PERMISSIONS open items, SUBMISSION §5 and §12, HACKATHON test count) | next: the user's own items (keeper top-up before about Oct 7; optionally one real Base Account run).
- [Tue Sep 29 17:20:57 2026] Rename to Mandate Layer: `6ca45ff` (UI, docs, agent text, repo URL), `05ab1f7` (landing hero labels, logo on one line); repo renamed on GitHub. Fork E2E on the new site: existing 22/22, fresh 22/22, reject 9/9, undeployed 30/30 (a first undeployed run timed out while the fresh fork warmed up; the rerun passed). Keeper funded: 0.0382 ETH on Base Sepolia (bridged from Ethereum Sepolia with the user's consent, L1 tx `0x5611b2be…`).
