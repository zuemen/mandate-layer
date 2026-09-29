// e2e-demo.ts — the replayable end-to-end demo for the Colosseum submission.
//
// Three separate identities, every step leaves a Base Sepolia transaction:
//   ① User    funds margin and opens a bounded AgentSessionManager session
//   ② User    signs an EIP-712 authorization VC for the agent (off-chain, did:pkh)
//   ③ Agent   pays for market data and a trader's signal over x402 (Circle USDC, EIP-3009) → seller
//   ③c Seller routes the signal fee through the x402 FeeRouter: 70% trader / 20% platform / 10% vault
//            (optional — runs when SELLER_PRIVATE_KEY is set)
//   ④ Agent   opens a position through the session, inside the caps
//   ⑤ Agent   tries a trade ABOVE the per-trade cap → mined and reverted on chain
//   ⑥ Agent   closes the position through the session
//   ⑦ User    revokes the session
//   ⑧ Agent   tries again after revocation → mined and reverted on chain
//
// ⑤ and ⑧ are sent with an explicit gas limit on purpose: the agent-side SDK
// would refuse them before they reach the chain, which proves nothing. Forcing
// them on chain shows the contract itself is the enforcement point.
//
// Requires a running signal-api (npm run signal-api) configured for this repo's
// deployment. Keys come ONLY from the environment:
//   USER_PRIVATE_KEY, AGENT_PRIVATE_KEY           (required)
//   SELLER_PRIVATE_KEY                            (optional: enables step ③c)
//   X402_FEE_ROUTER                               (defaults to this repo's x402 FeeRouter)
//   BASE_SEPOLIA_RPC_URL, X402_API_URL            (defaults: public RPC, localhost:4021)
//   SESSION_MANAGER_ADDRESS                       (defaults to addresses.ts value below)
//
// Writes demo/RUN.md (tx table), frontend/src/lib/pepefi/demoRun.json (shown on the
// Agent Mode page) and demo/out/<timestamp>.json (raw record).
//
//   cd agent && npx tsx examples/e2e-demo.ts
import { ethers } from "ethers";
import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ADDRESSES } from "@pepelab/shared";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const RPC = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
const API = (process.env.X402_API_URL?.trim() || "http://localhost:4021").replace(/\/$/, "");
const SESSION_MANAGER = process.env.SESSION_MANAGER_ADDRESS?.trim() || "0x71125e25c903AD4e198e1863d5Bf26df97926CDe";
process.env.SESSION_MANAGER_ADDRESS = SESSION_MANAGER;

// Session caps the user grants. The over-cap attempt uses OVER_CAP_MARGIN.
const CAP_PER_TRADE = 50;   // mUSDC
const CAP_BUDGET = 150;     // mUSDC, cumulative
const CAP_LEVERAGE = 3;
const TRADE_MARGIN = 20;
const TRADE_LEVERAGE = 2;
const OVER_CAP_MARGIN = 80; // > CAP_PER_TRADE
const DEPOSIT = 200;        // mUSDC the user deposits as margin
const SYMBOL = "sBTC";
const X402_FEE_ROUTER = process.env.X402_FEE_ROUTER?.trim() || "0xEeDcEE7cD62A644EA4Cf053f213d5D75dB0B49c6";
const CIRCLE_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const SIGNAL_FEE_UNITS = 10_000n; // 0.01 USDC (6 decimals) — the /signals/:trader price

const basescan = (h: string) => `https://sepolia.basescan.org/tx/${h}`;
const need = (k: string) => {
  const v = process.env[k]?.trim();
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`set ${k}=0x… (Base Sepolia test key)`);
  return v;
};

interface Step { n: string; actor: string; action: string; tx: string | null; result: string }
const steps: Step[] = [];
const log = (s: Step) => {
  steps.push(s);
  console.log(`${s.n} [${s.actor}] ${s.action}\n    → ${s.result}${s.tx ? `\n    ${basescan(s.tx)}` : ""}`);
};

function decodePaymentTx(res: Response): string | null {
  try {
    const h = res.headers.get("x-payment-response");
    if (!h) return null;
    const j = JSON.parse(Buffer.from(h, "base64").toString("utf8"));
    return j?.transaction ?? j?.txHash ?? null;
  } catch { return null; }
}

/** sepolia.base.org is load-balanced: a node can answer from a block before the tx we just
 *  mined, so the next estimateGas fails (e.g. an approve "not seen" yet). After each
 *  receipt, wait until three consecutive reads report a later block. */
let PROVIDER: ethers.JsonRpcProvider;
async function settled(tx: { wait: () => Promise<ethers.TransactionReceipt | null> }): Promise<ethers.TransactionReceipt> {
  const rc = await tx.wait();
  if (!rc) throw new Error("no receipt");
  for (let ok = 0; ok < 3;) {
    ok = (await PROVIDER.getBlockNumber()) > rc.blockNumber ? ok + 1 : 0;
    if (ok < 3) await new Promise((r) => setTimeout(r, 700));
  }
  return rc;
}

/** Send a call that is expected to revert, force it on chain, return hash + decoded reason. */
async function forceRevert(
  mgr: ethers.Contract, fn: string, args: unknown[], value: bigint,
): Promise<{ tx: string; reason: string }> {
  let reason = "unknown";
  try {
    await mgr[fn].staticCall(...args, { value });
    reason = "static call did NOT revert";
  } catch (e) {
    const err = e as { revert?: { name?: string }; shortMessage?: string };
    reason = err.revert?.name ?? err.shortMessage ?? String(e);
  }
  const tx = await mgr[fn](...args, { value, gasLimit: 600_000n });
  try {
    const rc = await tx.wait();
    return { tx: tx.hash, reason: rc?.status === 1 ? `UNEXPECTED SUCCESS (${reason})` : reason };
  } catch {
    return { tx: tx.hash, reason };
  }
}

async function main() {
  const userPk = need("USER_PRIVATE_KEY");
  const agentPk = need("AGENT_PRIVATE_KEY");
  const provider = new ethers.JsonRpcProvider(RPC, 84532, { staticNetwork: true });
  PROVIDER = provider;
  const user = new ethers.Wallet(userPk, provider);
  const agent = new ethers.Wallet(agentPk, provider);
  const rawAbi = JSON.parse(readFileSync(resolve(REPO, "frontend/src/contracts/abi/AgentSessionManager.json"), "utf8"));
  const abi = rawAbi.abi ?? rawAbi;
  const mgrUser = new ethers.Contract(SESSION_MANAGER, abi as ethers.InterfaceAbi, user);
  const mgrAgent = mgrUser.connect(agent) as ethers.Contract;
  const usdc = new ethers.Contract(ADDRESSES.MockUSDC, [
    "function faucet()", "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ], user);
  const exchange = new ethers.Contract(ADDRESSES.PerpetualExchange, [
    "function depositMargin(uint256)", "function executionFee() view returns (uint256)",
  ], user);
  const assetId = ethers.id(SYMBOL);
  const fee = (await exchange.executionFee()) as bigint;

  console.log(`\n=== Mandate Layer agent-session e2e demo (Base Sepolia) ===`);
  console.log(`User  ${user.address}\nAgent ${agent.address}\nSessionManager ${SESSION_MANAGER}\nExchange ${ADDRESSES.PerpetualExchange}\nSignal API ${API}\n`);

  // Fail fast if the signal-api is not up — the x402 step is the point of the demo.
  const dir = await fetch(`${API}/`).then((r) => r.json()).catch(() => null);
  if (!dir) throw new Error(`signal-api not reachable at ${API} — start it with \`npm run signal-api\``);

  // ① User: margin + bounded session ────────────────────────────────────────
  const dep = ethers.parseUnits(String(DEPOSIT), 18);
  // mint() is owner-only since the audit; users take 1,000 mUSDC per 24 h from faucet().
  // On a re-run inside the cooldown the balance from the previous claim is reused.
  if (((await usdc.balanceOf(user.address)) as bigint) < dep) {
    const t1 = await usdc.faucet(); await settled(t1);
  }
  const t2 = await usdc.approve(ADDRESSES.PerpetualExchange, dep); await settled(t2);
  const t3 = await exchange.depositMargin(dep); await settled(t3);
  log({ n: "①a", actor: "User", action: `faucet + approve + depositMargin ${DEPOSIT} mUSDC`, tx: t3.hash, result: "margin deposited" });

  const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const t4 = await mgrUser.createSessionWithAssets(
    agent.address,
    ethers.parseUnits(String(CAP_PER_TRADE), 18),
    ethers.parseUnits(String(CAP_BUDGET), 18),
    CAP_LEVERAGE, expiry, [ethers.id("sBTC"), ethers.id("sETH")],
  );
  const rc4 = await settled(t4);
  const created = rc4.logs.map((l: ethers.Log) => { try { return mgrUser.interface.parseLog(l); } catch { return null; } })
    .find((p: ethers.LogDescription | null) => p?.name === "SessionCreated");
  const sessionId = Number(created!.args[0]);
  log({ n: "①b", actor: "User", action: `createSessionWithAssets(agent, perTrade ${CAP_PER_TRADE}, budget ${CAP_BUDGET}, ${CAP_LEVERAGE}x, 7d, [sBTC,sETH])`, tx: t4.hash, result: `session #${sessionId}` });

  // ② User signs the authorization VC ────────────────────────────────────────
  const shared = await import("@pepelab/shared");
  const vc = await shared.issueAuthorizationVC({
    issuer: user, agentAddress: agent.address, sessionId,
    caps: { maxMarginPerTrade: String(CAP_PER_TRADE), totalBudget: String(CAP_BUDGET), maxLeverage: CAP_LEVERAGE, expiry },
  });
  const outDir = resolve(REPO, "demo/out");
  mkdirSync(outDir, { recursive: true });
  const vcPath = resolve(outDir, `vc-session-${sessionId}.json`);
  writeFileSync(vcPath, JSON.stringify(vc, null, 2));
  const vcCheck = shared.verifyAuthorizationVC(vc);
  log({ n: "②", actor: "User", action: "sign EIP-712 authorization VC (did:pkh issuer → agent)", tx: null, result: `VC ${vcCheck.valid ? "valid" : "INVALID"} — saved demo/out/vc-session-${sessionId}.json` });

  // ③ Agent pays for data over x402 ──────────────────────────────────────────
  const account = privateKeyToAccount(agentPk as Hex);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) }).extend(publicActions);
  const payFetch = wrapFetchWithPayment(fetch, wallet as unknown as Parameters<typeof wrapFetchWithPayment>[1]);
  const res = await payFetch(`${API}/oracle/${SYMBOL}`, { method: "GET" });
  const body = (await res.json().catch(() => null)) as { data?: { fundingRateBps?: number; price?: number } } | null;
  const payTx = decodePaymentTx(res);
  const funding = Number(body?.data?.fundingRateBps ?? 0);
  const isLong = funding <= 0; // same transparent rule as x402-autotrade: crowded longs → short
  log({ n: "③a", actor: "Agent", action: `x402 GET /oracle/${SYMBOL} (402 → EIP-3009 USDC → 200)`, tx: payTx, result: `HTTP ${res.status}; funding ${funding} bps → ${isLong ? "long" : "short"}` });
  if (!res.ok) throw new Error(`x402 purchase failed: HTTP ${res.status} ${JSON.stringify(body)?.slice(0, 200)}`);

  // The User doubles as the strategy provider whose signal the agent buys.
  const sig = await payFetch(`${API}/signals/${user.address}`, { method: "GET" });
  await sig.json().catch(() => null);
  log({ n: "③b", actor: "Agent", action: `x402 GET /signals/${user.address.slice(0, 10)}… (trader signal, 0.01 USDC)`, tx: decodePaymentTx(sig), result: `HTTP ${sig.status}` });
  if (!sig.ok) throw new Error(`x402 signal purchase failed: HTTP ${sig.status}`);

  // ③c Seller routes the signal fee on chain: 70/20/10 through the x402 FeeRouter.
  const sellerPk = process.env.SELLER_PRIVATE_KEY?.trim();
  if (sellerPk && /^0x[0-9a-fA-F]{64}$/.test(sellerPk)) {
    const seller = new ethers.Wallet(sellerPk, provider);
    const cusdc = new ethers.Contract(CIRCLE_USDC, ["function approve(address,uint256) returns (bool)"], seller);
    const router = new ethers.Contract(X402_FEE_ROUTER, [
      "function routeExternalRevenue(address trader, uint256 fee)",
      "function traderEarnings(address) view returns (uint256)",
    ], seller);
    await settled(await cusdc.approve(X402_FEE_ROUTER, SIGNAL_FEE_UNITS));
    const rt = await router.routeExternalRevenue(user.address, SIGNAL_FEE_UNITS);
    await settled(rt);
    const earned = (await router.traderEarnings(user.address)) as bigint;
    log({ n: "③c", actor: "Seller", action: "routeExternalRevenue(trader = User, 0.01 USDC) on the x402 FeeRouter", tx: rt.hash, result: `70/20/10 split on chain; trader's accrued earnings now ${ethers.formatUnits(earned, 6)} USDC` });
  }

  // ④ Agent opens inside the caps (SDK path: VC verified + cross-checked on chain) ─
  const open = await shared.openPositionForSession({
    sessionId, symbol: SYMBOL, isLong, marginUsdc: TRADE_MARGIN, leverage: TRADE_LEVERAGE, authVc: vc,
  });
  if (!open.ok) throw new Error(`open failed: ${open.error}`);
  await settled({ wait: () => PROVIDER.waitForTransaction(open.txHash!) });
  log({ n: "④", actor: "Agent", action: `openPositionForSession(#${sessionId}, ${SYMBOL}, ${isLong ? "long" : "short"}, ${TRADE_MARGIN}, ${TRADE_LEVERAGE}x)`, tx: open.txHash ?? null, result: `position #${open.positionId}` });

  // ⑤ Over-cap attempt, forced on chain ──────────────────────────────────────
  const over = await forceRevert(mgrAgent, "openPositionForSession",
    [sessionId, assetId, isLong, ethers.parseUnits(String(OVER_CAP_MARGIN), 18), TRADE_LEVERAGE, ethers.ZeroAddress], fee);
  log({ n: "⑤", actor: "Agent", action: `openPositionForSession margin ${OVER_CAP_MARGIN} > cap ${CAP_PER_TRADE}`, tx: over.tx, result: `reverted on chain: ${over.reason}` });

  // ⑥ Agent closes the session's position ────────────────────────────────────
  const close = await shared.closePositionForSession({ sessionId, positionId: Number(open.positionId), authVc: vc });
  if (!close.ok) throw new Error(`close failed: ${close.error}`);
  await settled({ wait: () => PROVIDER.waitForTransaction(close.txHash!) });
  log({ n: "⑥", actor: "Agent", action: `closePositionForSession(#${sessionId}, position #${open.positionId})`, tx: close.txHash ?? null, result: "closed" });

  // ⑦ User revokes ────────────────────────────────────────────────────────────
  const t7 = await mgrUser.revokeSession(sessionId); await settled(t7);
  log({ n: "⑦", actor: "User", action: `revokeSession(#${sessionId})`, tx: t7.hash, result: "session revoked" });

  // ⑧ Post-revoke attempt, forced on chain ───────────────────────────────────
  const after = await forceRevert(mgrAgent, "openPositionForSession",
    [sessionId, assetId, isLong, ethers.parseUnits(String(TRADE_MARGIN), 18), TRADE_LEVERAGE, ethers.ZeroAddress], fee);
  log({ n: "⑧", actor: "Agent", action: `openPositionForSession after revoke (margin ${TRADE_MARGIN}, within caps)`, tx: after.tx, result: `reverted on chain: ${after.reason}` });

  // ── Record ────────────────────────────────────────────────────────────────
  const stamp = new Date().toISOString();
  writeFileSync(resolve(outDir, `run-${stamp.replace(/[:.]/g, "-")}.json`), JSON.stringify({ stamp, user: user.address, agent: agent.address, sessionId, steps }, null, 2));
  const md = [
    "# Demo run — agent session on Base Sepolia",
    "",
    `Generated by \`agent/examples/e2e-demo.ts\` at ${stamp}. Every row with a transaction can be checked on BaseScan.`,
    "",
    `- User: \`${user.address}\``,
    `- Agent: \`${agent.address}\``,
    `- AgentSessionManager: \`${SESSION_MANAGER}\` · PerpetualExchange: \`${ADDRESSES.PerpetualExchange}\``,
    `- Session #${sessionId} caps: ${CAP_PER_TRADE} mUSDC per trade · ${CAP_BUDGET} mUSDC budget · ${CAP_LEVERAGE}x · assets sBTC, sETH · 7-day expiry`,
    "",
    "| Step | Actor | Action | Result | Transaction |",
    "|---|---|---|---|---|",
    ...steps.map((s) => `| ${s.n} | ${s.actor} | ${s.action} | ${s.result} | ${s.tx ? `[${s.tx.slice(0, 10)}…](${basescan(s.tx)})` : "off-chain"} |`),
    "",
    "Steps ⑤ and ⑧ are sent with an explicit gas limit so the rejection is mined: the revert comes from `AgentSessionManager`, not from the agent's own SDK.",
    "",
    "Replay: start `npm run signal-api` (configured per `agent/.env.example`), then `cd agent && npx tsx examples/e2e-demo.ts`.",
    "",
  ].join("\n");
  writeFileSync(resolve(REPO, "demo/RUN.md"), md);
  // The frontend Agent Mode page shows this run, because reverted transactions emit
  // no events and so cannot be recovered from logs later.
  const seller = process.env.SELLER_PRIVATE_KEY?.trim() ? new ethers.Wallet(process.env.SELLER_PRIVATE_KEY.trim()).address : null;
  writeFileSync(resolve(REPO, "frontend/src/lib/pepefi/demoRun.json"), JSON.stringify({
    generatedAt: stamp, user: user.address, agent: agent.address, seller,
    sessionManager: SESSION_MANAGER, exchange: ADDRESSES.PerpetualExchange, sessionId,
    caps: { perTrade: CAP_PER_TRADE, budget: CAP_BUDGET, leverage: CAP_LEVERAGE, assets: ["sBTC", "sETH"] },
    steps,
  }, null, 2) + "\n");
  console.log(`\nWrote demo/RUN.md`);
}

main().catch((e) => { console.error("e2e-demo failed:", (e as Error)?.message ?? e); process.exit(1); });
