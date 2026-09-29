# Base Account card: browser E2E on a Base Sepolia fork

The Sessions page has a card, **Fund the agent from a Base Account**, that sets up a funded, bounded agent in one
EIP-5792 batch (`wallet_sendCalls`, `atomicRequired: true`):

1. `SpendPermissionManager.approve(permission)`: a Base Spend Permission for our funder, in mUSDC per day
2. `SpendPermissionMarginFunder.setTopUpAgent(agent)`
3. `AgentSessionManager.createSessionWithAssets(agent, caps…, [sBTC, sETH])`

For a deployed account that does not list SpendPermissionManager as an owner, the batch adds
`addOwnerAddress(SpendPermissionManager)` first. For an account the wallet has not deployed yet it never does: if the
wallet's initCode already lists SpendPermissionManager, `AlreadyOwner` would revert the whole batch. If the wallet then
creates the account *without* it, the card notices after the batch and offers a one-call fix (below). The session's
authorization credential is then signed from the session list. A Base Account returns an ERC-1271 signature.

The same three calls ran for real on Base Sepolia on 2026-09-24 (tx `0x7f6939cd…`, see
[SPEND_PERMISSIONS_RUN.md](SPEND_PERMISSIONS_RUN.md)). `frontend/src/lib/pepefi/baseAccountSetup.test.ts` pins the
calldata the card builds to that transaction, byte for byte.

This page covers the browser side. The deployed site was driven by Playwright against a local anvil fork of Base Sepolia,
with a mock wallet injected into the page.

## What was run

`demo/e2e/base_account_fork_e2e.py` runs the E2E against <https://zuemen.github.io/pepelab-colosseum>:

- 2026-09-24: at commit `7a10249`, and again after the first review fixes at `f57a933`.
- 2026-09-29: after each of three review rounds (`1cfa0f3`, `5a61953`, `830f2f5`) and last at `94d2225` (bundle
  `index-WQUUQ7cX.js`). Each run checks that the latest successful Pages deployment has the checkout's frontend and
  writes the bundle URL, the commit and that deployment's commit to `result.json`.

The mock EIP-1193 wallet behaves like a Coinbase Smart Wallet:

| Page asks for | Mock wallet does (on the fork) |
|---|---|
| `eth_*` | forwards to anvil |
| `wallet_sendCalls` | a throwaway owner key sends the smart wallet's `executeBatch(calls)`; in `undeployed`, it first creates the account through the factory |
| `wallet_getCallsStatus` | returns the receipt in EIP-5792 2.0.0 shape |
| `eth_signTypedData_v4` | owner signs the wallet's `replaySafeHash(digest)`, wrapped as `SignatureWrapper(ownerIndex, sig)` |

The throwaway key only exists on the fork. The script never loads a real key, and nothing is sent to Base Sepolia.

| Scenario | Account | SpendPermissionManager already an owner? | Batch |
|---|---|---|---|
| `existing` | `0x56D83fEe…435F`, the Base Account from the recorded run | yes | 3 calls |
| `fresh` | a new Coinbase Smart Wallet (factory `0x0BA5ED0c…`), whose only owner is the throwaway key | no | 4 calls (adds it first) |
| `undeployed` | not deployed yet; the wallet creates it inside `wallet_sendCalls` with the throwaway key as its only owner (the worst case: no SpendPermissionManager) | no, and the batch cannot add it | 3 calls, then the one-call fix |
| `reject` | as `existing`, but the wallet declines `wallet_sendCalls` (EIP-1193 4001) | yes | none reaches the chain |

## Result on 2026-09-29 (`94d2225`): existing 22/22, fresh 22/22, undeployed 30/30, reject 9/9

![The card after a confirmed batch, fresh scenario](../docs/img/base-account-card.png)

| # | Check | existing | fresh | undeployed |
|---|---|---|---|---|
| 1 | Fork setup: the throwaway key is an owner, SpendPermissionManager owner state as expected (undeployed: the account has no code yet) | ✅ | ✅ | ✅ |
| 2 | The card recognises the account (and says what the batch will do) | ✅ | ✅ | ✅ |
| 3 | The latest successful Pages deployment has this checkout's frontend | ✅ | ✅ | ✅ |
| 4 | The CTA is enabled once the agent address is filled | ✅ | ✅ | ✅ |
| 5 | The batch confirms and the page shows **Done** with the tx link | ✅ | ✅ | ✅ |
| 6 | The card reads the account again after the batch | ✅ | ✅ | ✅ |
| 7 | The status never goes back to "Checking…" after the first read (a MutationObserver watches it) | ✅ | ✅ | ✅ |
| 8 | `wallet_sendCalls` used EIP-5792 2.0.0 with `atomicRequired: true` | ✅ | ✅ | ✅ |
| 9 | Batch length for the scenario (3 / 4 / 3) | ✅ | ✅ | ✅ |
| 10 | Exactly one session opened | ✅ | ✅ | ✅ |
| 11 | `session.user` is the Base Account | ✅ | ✅ | ✅ |
| 12 | `session.agent` is the agent | ✅ | ✅ | ✅ |
| 13 | `funder.topUpAgent(account)` is the agent | ✅ | ✅ | ✅ |
| 14 | `SpendPermissionManager.isApproved(<the JSON the page shows>)` is true | ✅ | ✅ | ✅ |
| 15 | SpendPermissionManager is an owner (undeployed: after the fix) | ✅ | ✅ | ✅ |
| 16 | **The agent tops up margin with that permission**: `funder.topUp` moves 5 mUSDC into the exchange margin | ✅ | ✅ | ✅ |
| 17 | The new session appears in the list | ✅ | ✅ | ✅ |
| 18 | No failed requests (other than GitHub Pages' deep-link fallback) | ✅ | ✅ | ✅ |
| 19 | ERC-1271 `isValidSignature(digest, credential signature)` returns `0x1626ba7e` | ✅ | ✅ | ✅ |
| 20 | No console errors on the page | ✅ | ✅ | ✅ |
| 21 | **The agent's own verifier** (`verifyAuthorizationVCWithProvider`, via `agent/examples/verify-vc-file.ts`) accepts the credential | ✅ | ✅ | ✅ |

`existing` and `fresh` have one more fork-setup row each (22). `undeployed` adds the fix:

| # | Check (undeployed only) | |
|---|---|---|
| U1 | After the batch, SpendPermissionManager is **not** an owner (the worst case reproduced) | ✅ |
| U2 | Before the fix, the agent's `topUp` (simulated from the agent) reverts with the account's own `Unauthorized()` (`0x82b42900`): the account refuses SpendPermissionManager's call | ✅ |
| U3 | The fix button appears | ✅ |
| U4 | Until the fix, the status points to it and the main button is disabled (it would open a second session and approve a second Spend Permission) | ✅ |
| U5 | After a reload and a fresh read of the account, the fix is still offered with the same Spend Permission JSON (kept per account in sessionStorage) | ✅ |
| U6 | The page reports the fix confirmed | ✅ |
| U7 | The fix is a single call: the account calls `addOwnerAddress(SpendPermissionManager)` (second `wallet_sendCalls`, one call) | ✅ |
| U8 | The fix opens no new session | ✅ |
| U9 | The fix button is gone once SpendPermissionManager is an owner | ✅ |

Controls: the same script run against the site before the fixes failed the checks that cover them. `reject` against
the site built from `f57a933` failed row 7 (the status flashed "Checking…" after the rejection), and `undeployed`
against the site built from `5a61953` failed U5 (after a reload the fix was gone and the page offered the full batch
again).

Earlier runs: after `7a10249` the script passed 20/20 four times in a row (two per scenario), and after `0cd77a4`
`existing` 20/20, `fresh` 20/20, `reject` 8/8. One run before `7a10249` found a bug: after the batch landed, the card
still said it would add SpendPermissionManager and showed the old balance. Row 6 covers that now.

## Rejection: 9/9 checks

The first four checks are rows 1–4 above. Then: the page says "You declined the request in your wallet. Nothing was
sent."; the wallet was asked exactly once; the button is usable again; the status did not flash "Checking…". (The
mock refuses before sending anything, so the chain has nothing to check.) Before `0cd77a4` a rejection opened the wallet
a second time. The page retried with the EIP-5792 1.0 request shape whenever an error message contained "version", and
every ethers v6 error message ends with `version=6.x`. Since `886ab7f` only a real version error falls back to 1.0:
MetaMask's `-32000` "Version not supported: Got …, expected …" (its `validateSendCallsVersion`) or a `-32602` that
names a version. `walletCalls.test.ts` runs wallet errors through a real ethers `BrowserProvider`.

## What this does not show

- **Not a real Base Account in a real browser.** The mock produces the same calls and the same signature format as a
  Coinbase Smart Wallet, but the Base Account popup and its SDK were not in the loop. In particular, whether the real
  wallet accepts a `wallet_sendCalls` whose only call targets the account itself (the fix) is not shown.
- **Whether a new Base Account lists SpendPermissionManager from the start** is not known (keys.coinbase.com is closed
  source; Coinbase's CDP SDK adds it only when asked). `undeployed` covers the case where it does not. The mock does it
  with two transactions (create the account, then run the batch); a real wallet does both in one user operation.
- Switching accounts while a wallet popup is open: the card for the new account does not know about the old request.
- The fork is local. The only on-chain run of this batch is the scripted one in
  [SPEND_PERMISSIONS_RUN.md](SPEND_PERMISSIONS_RUN.md).

## Run it

```bash
anvil --fork-url https://base-sepolia-rpc.publicnode.com --chain-id 84532 --block-time 1
pip install playwright eth-account && python -m playwright install chromium
(cd agent && npm ci)
python demo/e2e/base_account_fork_e2e.py existing     # or: fresh, undeployed, reject
```

A second argument points the script at another site, e.g. a local `vite` dev server started with the Pages settings
(`VITE_LOCALE=en VITE_BASE_PATH=/pepelab-colosseum/ VITE_ASSETS_DIR=/pepelab-colosseum`; in Git Bash also
`MSYS_NO_PATHCONV=1`): `python demo/e2e/base_account_fork_e2e.py undeployed http://localhost:5173/pepelab-colosseum`.

Screenshots, the permission JSON, the credential and `result.json` are written to `demo/e2e/out/<scenario>/` (ignored by git).
