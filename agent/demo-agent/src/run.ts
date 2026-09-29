// Demo Agent（北極星 demo）：自管 EOA 付 x402 費用 → 讀訊號 → 依決策**經 session
// 限額真的開一筆受限部位** → 印出 tx hash 與部位。
// 端到端展示：「agent 付 0.01 USDC 買訊號 → 自主下單」。
// 優雅退化：
//   - 無有效金鑰：DRY-RUN，直接讀鏈上訊號（跳過 x402 結算）仍印決策。
//   - 無 session（缺 SESSION_MANAGER_ADDRESS / DEMO_SESSION_ID）：只讀 + 印出
//     「本來會下的單」，不送鏈、不 crash。
import { type Hex, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { readFileSync } from "node:fs";
import {
  loadEnv,
  makeProvider,
  makeContracts,
  getOracleSnapshot,
  getTraderPerformance,
  openPositionForSession,
  getSessionManagerAddress,
  agentDid,
  verifyAuthorizationVCWithProvider,
  parseOracleBody,
  parseSignalsBody,
  type AuthorizationVC,
  jsonSafe,
} from "@pepelab/shared";

loadEnv();

// 可選：使用者簽發的授權 VC（W3C VC / did:pkh）。提供時下單前必須驗證通過。
//   AGENT_AUTH_VC      = VC JSON 字串
//   AGENT_AUTH_VC_PATH = VC JSON 檔路徑
function loadAuthVc(): AuthorizationVC | null {
  const raw = process.env.AGENT_AUTH_VC?.trim();
  const path = process.env.AGENT_AUTH_VC_PATH?.trim();
  try {
    if (raw) return JSON.parse(raw) as AuthorizationVC;
    if (path) return JSON.parse(readFileSync(path, "utf8")) as AuthorizationVC;
  } catch (e) {
    console.log(`⚠ 無法載入 AGENT_AUTH_VC：${(e as Error).message}`);
  }
  return null;
}
const AUTH_VC = loadAuthVc();

const API = process.env.SIGNAL_API_URL ?? "http://localhost:4021";
const ASSET = process.env.DEMO_ASSET ?? "sBTC";
const PK = process.env.AGENT_PRIVATE_KEY?.trim();
const SESSION_ID = process.env.DEMO_SESSION_ID?.trim();
const DEMO_MARGIN = Number(process.env.DEMO_MARGIN ?? "10"); // USDC，≥ MIN_MARGIN(10)
const ZERO = "0x0000000000000000000000000000000000000000";
// x402 結算與付款都走 Base Sepolia 官方 USDC；RPC 用來建 viem WalletClient 簽 EIP-3009。
const RPC = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
const PAY_TO = process.env.PAY_TO?.trim() || "";
const X402_FEE_ROUTER = process.env.X402_FEE_ROUTER?.trim() || "";

// 分析對象：env 優先；未指定就自動挑鏈上第一個已註冊 trader（讓 demo 直接有料）。
let TRADER = process.env.DEMO_TRADER_ADDRESS?.trim() || "";

async function resolveTrader(): Promise<string> {
  if (TRADER) return TRADER;
  const c = makeContracts(makeProvider());
  const list = (await c.registry.getAllTraders()) as string[];
  if (list.length === 0) {
    throw new Error("鏈上尚無任何已註冊 trader，請在 .env 指定 DEMO_TRADER_ADDRESS");
  }
  TRADER = list[0];
  return TRADER;
}

function banner(t: string) {
  console.log("\n" + "─".repeat(64) + `\n${t}\n` + "─".repeat(64));
}

/** 把訊號餵進決策引擎並印出（付費路徑與 dry-run 路徑共用）。 */
function printDecision(oracle: any, perf: any) {
  banner("③ Agent 決策（Phase 1 不真下單）");
  console.log(
    `${ASSET} 現價 ${oracle.price}（${oracle.isStale ? "⚠ 陳舊" : "新鮮"}），funding ${oracle.fundingRatePercent}% ${oracle.fundingDirection}`,
  );
  if (!perf?.isRegistered) {
    console.log(`✗ ${TRADER} 尚未註冊為 trader，無策略可跟。決策：SKIP ALL`);
    return;
  }
  const net = perf.positions?.netPnL ?? 0;
  console.log(
    `trader「${perf.displayName}」淨 PnL：${net.toFixed(2)} USDC（已實現 ${perf.positions.realizedPnL.toFixed(2)} + 未實現 ${perf.positions.unrealizedPnL.toFixed(2)}）`,
  );
  console.log("逐腿決策：");
  for (const s of perf.suggestion ?? []) {
    const follow = !s.fundingHeadwind && net >= 0;
    const verb = follow ? "✓ WOULD FOLLOW" : "✗ SKIP";
    console.log(
      `  ${verb}  ${s.asset} ${s.direction} ${s.leverage}x (權重 ${s.weightPercent}%) — ${s.note}`,
    );
  }
}

/** 從績效訊號挑出第一筆值得跟的腿（與 printDecision 的 follow 規則一致）。 */
function pickTrade(
  perf: any,
): { symbol: string; isLong: boolean; leverage: number } | null {
  if (!perf?.isRegistered) return null;
  const net = perf.positions?.netPnL ?? 0;
  if (net < 0) return null;
  for (const s of perf.suggestion ?? []) {
    if (!s.fundingHeadwind) {
      return {
        symbol: s.asset,
        isLong: s.direction === "long",
        leverage: s.leverage,
      };
    }
  }
  return null;
}

/** 北極星步驟：依決策經 session 限額真下單；缺 session/key 時優雅退化成模擬。 */
async function executeOrSimulate(
  trade: { symbol: string; isLong: boolean; leverage: number } | null,
) {
  banner("④ 經 session 自主下單（受限委派）");
  if (!trade) {
    console.log("無可跟訊號（淨 PnL<0 或全逆風）→ 不下單。");
    return;
  }
  const wouldBe = `${trade.symbol} ${trade.isLong ? "LONG" : "SHORT"} ${trade.leverage}x，保證金 ${DEMO_MARGIN} USDC`;
  const hasKey = PK && PK.startsWith("0x") && PK.length === 66;

  if (!hasKey || !SESSION_ID || getSessionManagerAddress() === ZERO) {
    console.log(
      "⚠ 未配置自主下單（需 AGENT_PRIVATE_KEY + SESSION_MANAGER_ADDRESS + DEMO_SESSION_ID）。",
    );
    console.log(`  本來會下的單：${wouldBe}（模擬，未送鏈）。`);
    return;
  }

  // VC/SSI 閘門（A-3）：VC 是**必要**的，不是「有帶才驗」。缺 VC 直接退化成模擬，
  // 不送鏈——write 層也會再拒絕一次，這裡只是給出人看得懂的訊息。
  if (!AUTH_VC) {
    console.log("🛑 未提供授權憑證（AGENT_AUTH_VC / AGENT_AUTH_VC_PATH）→ 拒絕下單。");
    console.log(`  本來會下的單：${wouldBe}（模擬，未送鏈）。`);
    return;
  }
  // EOA 用 ecrecover；Base Account 等智慧帳戶簽的憑證用 ERC-1271 在鏈上驗章。
  const v = await verifyAuthorizationVCWithProvider(AUTH_VC, makeProvider());
  if (v.valid) {
    console.log(`🪪 授權憑證已驗證 ✓（issuer ${v.issuer} → agent ${v.agent}, session #${v.sessionId}）`);
  } else {
    console.log(`🛑 授權憑證驗證失敗 → 拒絕下單：${v.reason}`);
    console.log(`  （正反對照：竄改 VC 或換 agent 即無法下單）`);
    return;
  }

  console.log(`送出：${wouldBe}（session #${SESSION_ID}）…`);
  const res = await openPositionForSession({
    sessionId: Number(SESSION_ID),
    symbol: trade.symbol,
    isLong: trade.isLong,
    marginUsdc: DEMO_MARGIN,
    leverage: trade.leverage,
    authVc: AUTH_VC,
  });
  if (res.ok) {
    console.log(
      `✓ 已開倉：tx ${res.txHash}，positionId ${res.positionId}（agent ${res.agent}，session #${res.sessionId}）`,
    );
  } else {
    console.log(`✗ 下單失敗：${res.error}`);
    console.log(`  （優雅退化）本來會下的單：${wouldBe}`);
  }
}

/** DRY-RUN：沒有付款錢包時，直接讀鏈上拿訊號（跳過 x402 結算），仍跑決策。 */
async function dryRun() {
  console.log(
    "\n⚠ 未提供有效 AGENT_PRIVATE_KEY（見 .env.example）。\n" +
      "  進入 DRY-RUN：跳過 x402 USDC 結算，直接讀鏈上訊號並印決策。\n" +
      "  要跑真正「付 0.01 USDC」流程，請在 .env 填入有 Base Sepolia 測試\n" +
      "  USDC + ETH 的 AGENT_PRIVATE_KEY，並把 PAY_TO 設為 Base 上可收款地址。",
  );
  const c = makeContracts(makeProvider());
  banner("① 讀 oracle 快照（DRY-RUN，未付費）");
  const oracle = jsonSafe(await getOracleSnapshot(c, ASSET));
  console.log(JSON.stringify(oracle, null, 2));
  banner("② 讀 trader 訊號（DRY-RUN，未付費）");
  const perf = jsonSafe(await getTraderPerformance(c, TRADER));
  console.log(JSON.stringify(perf, null, 2));
  printDecision(oracle, perf);
  await executeOrSimulate(pickTrade(perf));
}

/** 真實付費路徑：經 signal-api 付 x402 費用拿訊號。 */
async function paidRun() {
  const account = privateKeyToAccount(PK as Hex);
  // x402-fetch 第二參數需要一個帶 chain+transport 的 viem WalletClient（才能解析
  // 出 base-sepolia 的付款需求並簽 EIP-3009 transferWithAuthorization）。傳裸
  // account 會讓它抓不到 chainId。
  // .extend(publicActions) 讓它同時具備 wallet + public actions，滿足 x402 的
  // SignerWallet 型別（執行面 isSignerWallet 只看 chain+transport，型別面要 public actions）。
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC),
  }).extend(publicActions);
  console.log(`agent 錢包  : ${account.address}（自管 EOA, Base Sepolia）`);

  // 遇 402 自動用 WalletClient 簽官方 USDC 授權（EIP-3009）並重送。
  // 轉型：x402-fetch 0.5.1 的 SignerWallet 型別與 viem 2.52 的 client 型別有版本落差
  // （執行面 isSignerWallet 只看 chain+transport，皆具備），故精準轉成其參數型別。
  const payFetch = wrapFetchWithPayment(
    fetch,
    walletClient as unknown as Parameters<typeof wrapFetchWithPayment>[1],
  );

  // 注意：payFetch 第二參數 init 不可省略——x402-fetch 在 402 重送時會讀 init，
  // 缺它會丟「Missing fetch request configuration」。
  banner("① 付費讀 oracle 快照（0.005 USDC, 官方 USDC）");
  const oracleRes = await payFetch(`${API}/oracle/${ASSET}`, { method: "GET" });
  const oracleBody = (await oracleRes.json().catch(() => null)) as any;
  console.log(JSON.stringify(oracleBody, null, 2));

  banner("② 付費讀 trader 訊號（0.01 USDC, 官方 USDC）");
  const sigRes = await payFetch(`${API}/signals/${TRADER}`, { method: "GET" });
  const sigBody = (await sigRes.json().catch(() => null)) as any;
  console.log(JSON.stringify(sigBody, null, 2));

  // A-1 同類修正：`body?.data ?? body` 會讓錯誤物件變成「資料」，決策就此建立在
  // 錯誤訊息上。兩份回應都先過 shared 的嚴格解析，任一不可用就停在這裡。
  const oracleParsed = parseOracleBody(oracleBody, oracleRes.status);
  if (!oracleParsed.ok) {
    console.log(`\n🛑 oracle 回應不可用：${oracleParsed.reason} → 不做決策、不下單。`);
    return;
  }
  const sigParsed = parseSignalsBody(sigBody, sigRes.status);
  if (!sigParsed.ok) {
    console.log(`\n🛑 signals 回應不可用：${sigParsed.reason} → 不做決策、不下單。`);
    return;
  }

  const perf = sigParsed.data;
  printDecision(oracleParsed.data, perf);
  await executeOrSimulate(pickTrade(perf));
}

async function main() {
  banner("Mandate Layer Demo Agent — x402 付費 → 自主下單（Base Sepolia）");
  await resolveTrader();
  console.log(`Signal API : ${API}`);
  console.log(`分析 trader : ${TRADER}${process.env.DEMO_TRADER_ADDRESS ? "" : "（自動挑選鏈上首位）"}`);
  console.log(`查詢資產    : ${ASSET}`);
  // x402 付款進 PAY_TO（treasury EOA）；70/20/10 結算由 signal-api 經 X402_FEE_ROUTER 執行。
  console.log(`x402 payTo  : ${PAY_TO || "(未設 PAY_TO — 由 signal-api 端決定)"}`);
  console.log(`x402 分潤路由: ${X402_FEE_ROUTER || "(未設，server 端 settlement 讀)"}（官方 USDC）`);

  const hasKey = PK && PK.startsWith("0x") && PK.length === 66;
  if (hasKey) {
    const acct = privateKeyToAccount(PK as Hex);
    console.log(`agent DID   : ${agentDid(acct.address)}`);
    console.log(`授權憑證(VC): ${AUTH_VC ? "已載入（下單前驗證）" : "未提供（session-only）"}`);
    await paidRun();
  } else {
    await dryRun();
  }
}

main().catch((err) => {
  console.error("demo agent 失敗：", err);
  process.exit(1);
});
