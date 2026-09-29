/**
 * PepeLab x402 Autonomous Agent — M2M Micro-Payment Workflow
 *
 * Demonstrates the complete x402 autonomous loop on Base Sepolia (84532):
 *   1. Agent discovers the signal-api endpoints (GET /)
 *   2. Attempts to fetch a paid signal → receives HTTP 402 (Payment Required)
 *   3. Uses Session Key to sign an EIP-3009 USDC micro-payment
 *   4. Re-sends the request with X-PAYMENT header → receives the signal
 *   5. (Optional) If a session is configured, autonomously opens a position
 *      via AgentSessionManager within budget/leverage constraints
 *
 * Prerequisites:
 *   - Node.js ≥ 20
 *   - npm install (from agent/ root)
 *   - AGENT_PRIVATE_KEY in agent/.env (EOA with Base Sepolia USDC + ETH)
 *
 * Usage:
 *   cd agent && npx tsx x402_agent.ts
 *   — or —
 *   npx tsx agent/x402_agent.ts
 */
import { createWalletClient, http, publicActions, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openPositionForSession } from "@pepelab/shared";
import { loadVc, verifyVcForAgent } from "./examples/vc-gate.ts";

// ── Load env from agent/.env ───────────────────────────────────────────────
const __here = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__here, ".env") });

// ── Configuration ──────────────────────────────────────────────────────────
const API_URL =
  process.env.SIGNAL_API_URL?.trim() || "http://localhost:4021";
const PK = process.env.AGENT_PRIVATE_KEY?.trim() ?? "";
const RPC =
  process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
const CHAIN_ID = 84532; // Base Sepolia

// Session Key configuration (Phase 2 — autonomous trading)
// mandate-layer 自己的 AgentSessionManager（2026-09-23 部署，帶 per-session 資產白名單）。
// 刻意不引用原專案 pepelab_onchain_cfd 的任何 manager。
const SESSION_MANAGER =
  process.env.SESSION_MANAGER_ADDRESS?.trim() ||
  "0x71125e25c903AD4e198e1863d5Bf26df97926CDe";
const SESSION_ID = process.env.DEMO_SESSION_ID?.trim();
const DEMO_MARGIN = Number(process.env.DEMO_MARGIN ?? "10");
const DEMO_ASSET = process.env.DEMO_ASSET ?? "sBTC";

// ABI fragments for on-chain interaction
const SESSION_MANAGER_ABI = [
  // openPositionForSession 的 ABI 已移除：下單改走 shared 的 openPositionForSession
  // （含 VC 閘門 + caps 預檢 + 由合約讀取的 executionFee）。這裡只保留唯讀的 sessions()。
  {
    name: "sessions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "user", type: "address" },
      { name: "agent", type: "address" },
      { name: "maxMarginPerTrade", type: "uint256" },
      { name: "totalMarginBudget", type: "uint256" },
      { name: "spentMargin", type: "uint256" },
      { name: "maxLeverage", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "revoked", type: "bool" },
    ],
  },
] as const;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// ── Helpers ────────────────────────────────────────────────────────────────
function banner(title: string) {
  console.log("\n" + "═".repeat(68));
  console.log(`  ${title}`);
  console.log("═".repeat(68));
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// ── Step 1: Discover API ───────────────────────────────────────────────────
async function discoverApi() {
  banner("① Discover Signal API");
  const res = await fetch(`${API_URL}/`);
  const data = await res.json() as any;
  console.log(`Service   : ${data.service}`);
  console.log(`Network   : ${data.network}`);
  console.log(`Pay To    : ${data.payTo}`);
  console.log(`Endpoints :`);
  for (const [path, info] of Object.entries(data.endpoints || {})) {
    const i = info as any;
    console.log(`  ${path.padEnd(30)} ${i.price.padEnd(8)} ${i.desc}`);
  }
  return data;
}

// ── Step 2: x402 Paid Signal Fetch ─────────────────────────────────────────
async function fetchPaidSignal(
  walletClient: any,
  traderAddress: string
): Promise<any> {
  banner("② Fetch Paid Signal (x402 micro-payment)");
  console.log(`Target    : ${API_URL}/signals/${traderAddress}`);
  console.log(`Price     : $0.01 USDC (Base Sepolia official USDC)`);

  // Dynamic import to handle x402-fetch
  let wrapFetchWithPayment: any;
  try {
    const x402Mod = await import("x402-fetch");
    wrapFetchWithPayment = x402Mod.wrapFetchWithPayment;
  } catch {
    console.log(
      "⚠ x402-fetch not installed. Run: npm install x402-fetch"
    );
    console.log(
      "  Falling back to direct API call (skipping x402 payment)..."
    );
    const res = await fetch(`${API_URL}/signals/${traderAddress}`);
    if (res.status === 402) {
      console.log("  ← Received HTTP 402 (Payment Required) as expected");
      console.log(
        "  The x402 protocol challenge is working. Install x402-fetch to auto-pay."
      );
      const body = await res.json().catch(() => ({}));
      console.log(
        `  Challenge details: ${JSON.stringify(body).slice(0, 200)}…`
      );
      return null;
    }
    return res.json();
  }

  // Wrap fetch to auto-handle 402 → sign USDC → retry
  const payFetch = wrapFetchWithPayment(
    fetch,
    walletClient as Parameters<typeof wrapFetchWithPayment>[1]
  );

  console.log("  Sending request (will auto-handle 402 challenge)...");
  const res = await payFetch(`${API_URL}/signals/${traderAddress}`, {
    method: "GET",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Signal API returned ${res.status}: ${errText}`);
  }

  const data = await res.json();
  console.log(`  ✓ Signal received successfully!`);
  if (data.settled) {
    console.log(`  ✓ On-chain 70/20/10 settlement confirmed`);
  }
  if (data.settlementTx) {
    console.log(
      `  ✓ Settlement tx: https://sepolia.basescan.org/tx/${data.settlementTx}`
    );
  }

  return data;
}

// ── Step 3: Analyze Signal & Decide ────────────────────────────────────────
interface TradeDecision {
  symbol: string;
  isLong: boolean;
  leverage: number;
}

function analyzeAndDecide(signalData: any): TradeDecision | null {
  banner("③ Agent Decision Engine");

  const perf = signalData?.data;
  if (!perf?.isRegistered) {
    console.log("✗ Trader not registered — SKIP ALL");
    return null;
  }

  const net = perf.positions?.netPnL ?? 0;
  console.log(
    `Trader "${perf.displayName}" net PnL: ${net.toFixed(2)} USDC`
  );
  console.log(
    `  Realized: ${(perf.positions?.realizedPnL ?? 0).toFixed(2)} | Unrealized: ${(perf.positions?.unrealizedPnL ?? 0).toFixed(2)}`
  );

  // Pick first non-headwind suggestion
  for (const s of perf.suggestion ?? []) {
    const follow = !s.fundingHeadwind && net >= 0;
    const verb = follow ? "✓ FOLLOW" : "✗ SKIP";
    console.log(
      `  ${verb}  ${s.asset} ${s.direction} ${s.leverage}x (weight ${s.weightPercent}%) — ${s.note}`
    );

    if (follow) {
      return {
        symbol: s.asset,
        isLong: s.direction === "long",
        leverage: s.leverage,
      };
    }
  }

  console.log("No suitable trades found — SKIP ALL");
  return null;
}

// （已刪除）這裡原本有一份硬編碼的 ASSET_IDS 表 —— 與 shared/addresses.ts 的
// 單一來源重複，改一邊忘另一邊就會對錯資產下單。現在 assetId 由
// openPositionForSession → assetIdOf() 解析。

// ── Step 4: Autonomous Trade via Session Key ───────────────────────────────
async function executeTradeViaSession(
  walletClient: any,
  trade: TradeDecision,
  traderAddress: string
): Promise<void> {
  banner("④ Autonomous Trade via Session Key");

  const desc = `${trade.symbol} ${trade.isLong ? "LONG" : "SHORT"} ${trade.leverage}x, margin ${DEMO_MARGIN} USDC`;

  if (!SESSION_ID || SESSION_MANAGER === ZERO_ADDR) {
    console.log("⚠ Session not configured (need SESSION_MANAGER_ADDRESS + DEMO_SESSION_ID)");
    console.log(`  Would have traded: ${desc} (simulated, not sent)`);
    return;
  }

  // Verify session is still active
  console.log(`  Verifying session #${SESSION_ID}...`);
  try {
    const sessionData = await walletClient.readContract({
      address: SESSION_MANAGER as `0x${string}`,
      abi: SESSION_MANAGER_ABI,
      functionName: "sessions",
      args: [BigInt(SESSION_ID)],
    });

    const [
      user,
      agent,
      maxMarginPerTrade,
      totalMarginBudget,
      spentMargin,
      maxLeverage,
      expiry,
      revoked,
    ] = sessionData as any;

    if (revoked) {
      console.log("  ✗ Session is revoked — cannot trade");
      return;
    }
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now > expiry) {
      console.log("  ✗ Session is expired — cannot trade");
      return;
    }

    console.log(`  Session owner : ${shortAddr(user)}`);
    console.log(`  Session agent : ${shortAddr(agent)}`);
    console.log(
      `  Budget        : ${formatUnits(spentMargin, 18)} / ${formatUnits(totalMarginBudget, 18)} USDC`
    );
    console.log(`  Max leverage  : ${Number(maxLeverage)}x`);
    console.log(
      `  Expires       : ${new Date(Number(expiry) * 1000).toISOString()}`
    );
  } catch (err) {
    console.log(`  ✗ Failed to read session: ${(err as Error).message}`);
    console.log(`  Would have traded: ${desc} (simulated)`);
    return;
  }

  console.log(`\n  Executing: ${desc} (session #${SESSION_ID})…`);

  // 稽核 A-3：這支以前用 viem 直接 writeContract 打 AgentSessionManager —— 是繞過
  // 整個 VC/SSI 授權層的**第四個**寫入路徑（連 write.ts 的閘門都碰不到），還自帶
  // 一份硬編碼的 ASSET_IDS 與 0.001 ETH execution fee（兩者都會與鏈上實況漂移）。
  // 現在一律走 shared 的 openPositionForSession：VC 必要、caps 預檢、assetId 與
  // executionFee 都從單一來源取得。
  const vc = loadVc();
  const vcChk = await verifyVcForAgent(vc, walletClient.account.address, Number(SESSION_ID));
  console.log(`  VC/SSI    : ${vcChk.ok ? "✓" : "✗"} ${vcChk.reason}`);
  if (!vcChk.ok) {
    console.log("  ✗ 缺有效授權 VC（設 AGENT_AUTH_VC_PATH）→ 拒絕下單。");
    console.log(`  Would have traded: ${desc} (simulated, not sent)`);
    return;
  }

  const res = await openPositionForSession({
    sessionId: Number(SESSION_ID),
    symbol: trade.symbol,
    isLong: trade.isLong,
    marginUsdc: DEMO_MARGIN,
    leverage: trade.leverage,
    authVc: vc!,
  });
  if (res.ok) {
    console.log(`  → Trade submitted to chain ✓ tx ${res.txHash} · position #${res.positionId ?? "?"}`);
  } else {
    console.error(`  ✗ Execution refused: ${res.error}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  banner("Mandate Layer x402 Autonomous Agent — Base Sepolia");

  // Validate private key
  const hasKey = PK.startsWith("0x") && PK.length === 66;

  if (!hasKey) {
    console.log(
      "⚠ No valid AGENT_PRIVATE_KEY set.\n" +
        "  Running in DISCOVERY-ONLY mode.\n" +
        "  To run the full x402 payment loop:\n" +
        "    1. Get Base Sepolia ETH from https://docs.base.org/chain/network-faucets\n" +
        "    2. Get test USDC from https://faucet.circle.com (select Base Sepolia)\n" +
        "    3. Set AGENT_PRIVATE_KEY in agent/.env\n"
    );
    await discoverApi();
    console.log("\n✓ Discovery complete. Set AGENT_PRIVATE_KEY to continue.\n");
    return;
  }

  // Set up wallet
  const account = privateKeyToAccount(PK as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC),
  }).extend(publicActions);

  console.log(`Agent wallet : ${account.address} (Base Sepolia)`);
  console.log(`Signal API   : ${API_URL}`);
  console.log(`Chain ID     : ${CHAIN_ID}`);
  console.log(`Session Mgr  : ${shortAddr(SESSION_MANAGER)}`);
  console.log(`Session ID   : ${SESSION_ID || "(not configured)"}`);

  // Step 1: Discover
  const discovery = await discoverApi();

  // Step 2: Fetch paid signal
  // Resolve a trader address for demo
  let traderAddr = process.env.DEMO_TRADER_ADDRESS?.trim() || "";
  if (!traderAddr) {
    // Try to get from discovery endpoints or use a placeholder
    console.log(
      "\n  ℹ No DEMO_TRADER_ADDRESS set. The signal API will auto-pick the first on-chain trader."
    );
    traderAddr = "0x0000000000000000000000000000000000000001"; // placeholder
  }

  let signalData: any = null;
  try {
    signalData = await fetchPaidSignal(walletClient, traderAddr);
  } catch (err) {
    console.error(`  ✗ Failed to fetch signal: ${(err as Error).message}`);
    console.log(
      "  This is expected if the signal-api server is not running."
    );
    console.log(
      "  Start it with: cd agent && npm run signal-api"
    );
  }

  // Step 3: Decide
  if (signalData) {
    const trade = analyzeAndDecide(signalData);

    // Step 4: Execute
    if (trade) {
      await executeTradeViaSession(walletClient, trade, traderAddr);
    } else {
      console.log("\n  → No actionable signal. Agent stays idle.");
    }
  }

  banner("✓ Agent Cycle Complete");
  console.log(
    "  In production, this would loop every 30s–5min.\n" +
      "  The agent:\n" +
      "    1. Paid $0.01 USDC via x402 (EIP-3009) for the signal\n" +
      "    2. Analyzed the trader's performance & funding rates\n" +
      "    3. Made an autonomous trading decision within session bounds\n" +
      "    4. Revenue was split 70/20/10 on-chain via FeeRouter\n"
  );
}

main().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(1);
});
