// x402-autonomous.ts — 會「自己決定要不要投資」的自主交易 agent。
//
// 與 x402-autotrade 的差別：這支用 Part A 的決策級資料(edge/清算價)，**可以決定不進場(skip)**。
// 流程（每步 console 清楚輸出）：
//   ① x402 真實付費 GET /oracle/<symbol>（402→簽官方 USDC EIP-3009→200），拿 enriched 資料
//      （edgeScore / recommendation / estLiquidation / isStale）。印付款上鏈 tx（x-payment-response）。
//   ② agent 自己判斷（核心：可 skip）：
//      • 回應形狀不合法（非 2xx / ok:false / 缺 data / recommendation 不在白名單）→ skip。
//      • tradableNow=false（超過交易所 maxPriceAge）或缺資料 → skip。
//      • recommendation==="no_trade"（|edge|<門檻）→ skip（訊號不夠強）。
//      • long/short → 方向；再過「清算距離」風險閘（< MIN_LIQ_DIST 就降槓桿；仍不行→skip）；
//        margin 取 min(想要, session 單筆上限)，超過剩餘預算→skip。
//   ③ 決定下單才開倉：openPositionForSession（session #6 限額內），印開倉 tx + positionId。
//   ④ skip：不下單不浪費 gas；但 x402 那筆資料費是真花費（付費做功課、決定不進場，合理）。
//
// 限制：x402 付款用官方 Base Sepolia USDC（Circle, EIP-3009）——錢包要先到 Circle 水龍頭領
// 官方 USDC + ETH。下單保證金是 session.user 在交易所存的模擬 USDT（兩種幣用途不同）。
// 加密 sBTC/sETH 免 KYC；RWA 需先 KYC 否則開倉 revert。edge 是透明規則式啟發、非投資建議。
//
// CLI：npx tsx examples/x402-autonomous.ts <symbol> <maxMargin> <leverage>   # 預設 sBTC 50 3
import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { pathToFileURL } from "node:url";
import {
  openPositionForSession, getSession, agentDid, appendAudit,
  parseOracleBody as parseOracle, type Recommendation, type AuditRecord,
} from "@pepelab/shared";
import { loadVc, verifyVcForAgent, fetchAgentVerification, AUDIT_PATH } from "./vc-gate.ts";

// ── 決策參數（透明可調）──────────────────────────────────────────────────────
const ENTRY_THRESHOLD = Number(process.env.X402_EDGE_ENTRY ?? "25"); // server 也用同門檻
const MIN_LIQ_DIST = Number(process.env.MIN_LIQ_DIST ?? "0.08");     // 現價到清算價最小距離 8%
const HARD_MAX_LEVERAGE = 5;

const API = (process.env.X402_API_URL ?? "http://localhost:4021").replace(/\/$/, "");
const PK = process.env.AGENT_PRIVATE_KEY?.trim();
const RPC = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
// session id 是每個 manager 各自獨立的。本 repo 的 AgentSessionManager 是
// 0x71125e25…6CDe（mandate-layer 自己的部署）；session 由 create-session.sh 建立。
// 預設 X402_API_URL 指向本機 signal-api —— 不得付費或寫入原專案 pepelab_onchain_cfd 的服務。
const SESSION_ID = Number(process.env.DEMO_SESSION_ID ?? "0");

const ALIASES: Record<string, string> = {
  btc: "sBTC", sbtc: "sBTC", eth: "sETH", seth: "sETH",
  aapl: "sAAPL", tsla: "sTSLA", nvda: "sNVDA", msft: "sMSFT", googl: "sGOOGL",
  gold: "sGOLD", bond: "sBOND", icln: "sICLN", esgu: "sESGU",
};
const norm = (s: string) => ALIASES[s.toLowerCase()] ?? s;
const link = (h?: string) => (h ? `https://sepolia.basescan.org/tx/${h}` : "(無 tx hash)");

function decodePaymentTx(res: Response): string | undefined {
  try {
    const h = res.headers.get("x-payment-response");
    if (!h) return undefined;
    const j = JSON.parse(Buffer.from(h, "base64").toString("utf8"));
    return j?.transaction ?? j?.txHash ?? undefined;
  } catch { return undefined; }
}

/** 在 want 以內找最高、且清算距離 ≥ minDist 的槓桿；找不到回 0（=不安全，skip）。
 *  清算距離 = 1/L − mm（與方向無關），mm=維持保證金率。 */
function fitLeverage(want: number, mm: number, minDist: number): number {
  for (let L = Math.min(Math.floor(want), HARD_MAX_LEVERAGE); L >= 1; L--) {
    if (1 / L - mm >= minDist) return L;
  }
  return 0;
}

// A-1 的形狀驗證住在 shared（apiResponse.ts），讓所有 agent 共用同一份白名單。
export { parseOracleBody } from "@pepelab/shared";

/** 純決策：吃 enriched oracle + 限制，回 {action, ...}。可獨立推理、好展示。
 *  任何非預期形狀（錯誤 body、缺欄位、未知 recommendation）一律 skip，不猜方向。 */
export function decide(input: {
  data: any; wantMargin: number; wantLeverage: number;
  sessionMaxPerTrade: number; sessionRemainingBudget: number; sessionMaxLev: number;
  /** 可選：HTTP 狀態碼；非 2xx 一律 skip。 */
  httpStatus?: number;
}): { action: "long" | "short" | "skip"; margin?: number; leverage?: number; reason: string } {
  // 已由呼叫端剝出 data 時（{price,recommendation,…}），包成 {ok:true,data} 再驗一次；
  // 直接餵整包 body 也可以——兩種形狀都會走同一組白名單檢查。
  const wrapped =
    input.data && typeof input.data === "object" && ("data" in input.data || "ok" in input.data)
      ? input.data
      : { ok: true, data: input.data };
  const parsed = parseOracle(wrapped, input.httpStatus);
  if (!parsed.ok) return { action: "skip", reason: `資料不可用 → 不投資（${parsed.reason}）` };
  const d = parsed.data;

  // 新鮮度：tradableNow 是交易所判準（優先）；缺它才退回 24h 的 isStale。
  const tradable = typeof d.tradableNow === "boolean" ? d.tradableNow : d.isStale !== true;
  if (!tradable) return { action: "skip", reason: "資料過期/不可交易（超過交易所 maxPriceAge），本輪不投資" };

  const rec = d.recommendation as Recommendation;
  if (rec === "no_trade") return { action: "skip", reason: `訊號不夠強（edge=${d.edgeScore}，門檻 ${ENTRY_THRESHOLD}），本輪不投資` };
  const isLong = rec === "long";
  const mm = (typeof d.maintenanceMarginBps === "number" ? d.maintenanceMarginBps : 500) / 10000;

  // 想要的保證金/槓桿本身必須是合法正數（CLI 打錯字不能變成 NaN 下單）。
  if (!Number.isFinite(input.wantMargin) || input.wantMargin <= 0)
    return { action: "skip", reason: `保證金參數非法（${input.wantMargin}）` };
  if (!Number.isFinite(input.wantLeverage) || input.wantLeverage < 1)
    return { action: "skip", reason: `槓桿參數非法（${input.wantLeverage}）` };

  // 風險閘：清算距離。先夾 session 最大槓桿，再依清算距離降槓桿。
  const wantLev = Math.min(input.wantLeverage, input.sessionMaxLev || HARD_MAX_LEVERAGE);
  const lev = fitLeverage(wantLev, mm, MIN_LIQ_DIST);
  if (lev === 0) return { action: "skip", reason: `清算距離不足（< ${(MIN_LIQ_DIST * 100).toFixed(0)}%），降槓桿仍不安全，不投資` };
  const dist = 1 / lev - mm;

  // 額度：margin 取 min(想要, session 單筆上限)；超過剩餘預算→skip。
  let margin = Math.min(input.wantMargin, input.sessionMaxPerTrade || input.wantMargin);
  if (margin <= 0) return { action: "skip", reason: "session 單筆上限為 0，不投資" };
  if (margin > input.sessionRemainingBudget) return { action: "skip", reason: `保證金 ${margin} 超過 session 剩餘預算 ${input.sessionRemainingBudget}，不投資` };

  const levNote = lev < input.wantLeverage ? `（已從 ${input.wantLeverage}x 降到 ${lev}x 以滿足清算距離）` : "";
  return { action: isLong ? "long" : "short", margin, leverage: lev,
    reason: `edge=${d.edgeScore} → ${isLong ? "做多" : "做空"}；清算距離 ${(dist * 100).toFixed(1)}% ≥ ${(MIN_LIQ_DIST * 100).toFixed(0)}%${levNote}；保證金 ${margin} USDT` };
}

async function main() {
  const [, , symbolArg = "sBTC", marginArg = "50", levArg = "3"] = process.argv;
  const symbol = norm(symbolArg);
  const wantMargin = Number(marginArg);
  const wantLeverage = Number(levArg);

  if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) throw new Error("設 AGENT_PRIVATE_KEY=0x…（需持官方 USDC + ETH）");
  if (!process.env.SESSION_MANAGER_ADDRESS?.trim()) throw new Error("設 SESSION_MANAGER_ADDRESS");

  console.log(`\n=== x402-autonomous ===  ${symbol}  maxMargin=${wantMargin}  ${wantLeverage}x  session #${SESSION_ID}`);

  // ① x402 付費取 enriched 資料
  const account = privateKeyToAccount(PK as Hex);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) }).extend(publicActions);
  const payFetch = wrapFetchWithPayment(fetch, wallet as unknown as Parameters<typeof wrapFetchWithPayment>[1]);
  console.log("付款錢包（官方 USDC）：", account.address);

  console.log(`\n① x402 付費 0.005 USDC → GET /oracle/${symbol}（402 → 簽 EIP-3009 → 200）`);
  const res = await payFetch(`${API}/oracle/${symbol}`, { method: "GET" });
  const body = (await res.json().catch(() => null)) as any;
  console.log("   HTTP", res.status, "· x402 付款上鏈 tx:", link(decodePaymentTx(res)));

  // A-1：先驗形狀，再談決策。錯誤 body 永遠不會走到「有 data」的路徑。
  const parsed = parseOracle(body, res.status);
  const data = parsed.ok ? parsed.data : null;
  if (!parsed.ok) {
    console.error(`   ⚠ 回應不可用：${parsed.reason} → 本輪一律 skip（不下單）。`);
    console.error(`     原始 body：${JSON.stringify(body)?.slice(0, 300)}`);
  } else {
    console.log("   決策級資料：", JSON.stringify({
      price: data.price, fundingRateBps: data.fundingRateBps, oiImbalance: data.oiImbalance,
      edgeScore: data.edgeScore, recommendation: data.recommendation, confidence: data.confidence,
      isStale: data.isStale, tradableNow: data.tradableNow,
    }));
  }

  // VC/SSI 閘門（E1）：載入使用者簽發的授權 VC；缺檔/壞檔/無效 → 可研究但**不准下單**。
  const vc = loadVc();
  const vcChk = await verifyVcForAgent(vc, account.address, SESSION_ID);
  console.log(`\nVC/SSI：${vcChk.ok ? "✓" : "✗"} ${vcChk.reason}` + (vcChk.issuerDid ? `（issuer ${vcChk.issuerDid}）` : ""));
  if (!vc) console.error("   ⚠ 缺有效 VC（AGENT_AUTH_VC_PATH）→ 本次只做研究，拒絕下單（不可否認鏈不成立）。");

  // 讀 session 限額
  const s: any = await getSession(SESSION_ID);
  const det = s?.detail ?? {};
  const sessionMaxPerTrade = Number(det.maxMarginPerTrade ?? 0);
  const sessionRemainingBudget = Number(det.totalMarginBudget ?? 0) - Number(det.spentMargin ?? 0);
  const sessionMaxLev = Number(det.maxLeverage ?? HARD_MAX_LEVERAGE);

  // ② agent 自己判斷
  const dec = decide({ data, wantMargin, wantLeverage, sessionMaxPerTrade, sessionRemainingBudget, sessionMaxLev, httpStatus: res.status });
  console.log(`\n② 決策：${dec.action === "skip" ? "skip（不投資）" : dec.action} — ${dec.reason}`);

  // E3：agent 可信度（ERC-8126，免費端點、best-effort）
  const agentVerification = await fetchAgentVerification(API, agentDid(account.address));

  const settlementTx = decodePaymentTx(res) ?? null;
  const rec: AuditRecord = {
    ts: new Date().toISOString(),
    issuerDid: vcChk.issuerDid,
    agentDid: agentDid(account.address),
    sessionId: SESSION_ID,
    vc: { id: vcChk.id, expiry: vcChk.expiry, verified: vcChk.ok, reason: vcChk.reason },
    research: { resource: `/oracle/${symbol}`, priceUsdc: "0.005", settlementTx },
    decision: { edgeScore: data?.edgeScore ?? null, side: dec.action, reason: dec.reason },
    action: { opened: false, positionId: null, txHash: null },
    agentVerification,
  };

  // ③ 下單條件：決策為 long/short **且** VC 有效（帶 authVc → 鏈上交叉比對）。
  if (dec.action === "skip") {
    console.log("\n④ 本輪不下單（x402 資料費已花，研究後決定不進場）。");
  } else if (!vcChk.ok) {
    rec.decision.reason += `；VC 無效 → 拒絕下單`;
    console.log(`\n④ 決策為 ${dec.action}，但 VC 無效 → 拒絕下單（${vcChk.reason}）。`);
  } else {
    const isLong = dec.action === "long";
    console.log(`\n③ openPositionForSession(#${SESSION_ID}, ${symbol}, ${isLong ? "long" : "short"}, ${dec.margin}, ${dec.leverage}x, authVc) 上鏈中…⏳`);
    const r = await openPositionForSession({ sessionId: SESSION_ID, symbol, isLong, marginUsdc: dec.margin!, leverage: dec.leverage!, authVc: vc! });
    if (!r.ok) {
      rec.decision.reason += `；開倉被拒：${r.error}`;
      console.error(`   ❌ 開倉被拒：${r.error}`);
    } else {
      rec.action = { opened: true, positionId: r.positionId ?? null, txHash: r.txHash ?? null };
      console.log(`   ✓ 開倉 tx: ${link(r.txHash)}  · position #${r.positionId ?? "?"}`);
    }
  }

  appendAudit(AUDIT_PATH, rec);
  console.log(`\n稽核已寫入 ${AUDIT_PATH}（verified=${rec.vc.verified}, opened=${rec.action.opened}）`);

  console.log("\n=== 不可否認鏈（可獨立核對）===");
  console.log("VC(誰授權)   :", rec.issuerDid ?? "—", rec.vc.verified ? "✓" : "✗");
  console.log("① x402 付款 tx:", link(settlementTx ?? undefined));
  if (rec.action.opened) console.log("③ 開倉 tx    :", link(rec.action.txHash ?? undefined));
  console.log("→ 用 audit-verify.ts 可重新驗證此筆是否可被承認。");
}

// 只有「直接執行」這支時才跑 main；被 x402-loop.ts import（取 decide）時不自動執行。
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch((e) => { console.error("x402-autonomous 失敗：", e?.message ?? e); process.exit(1); });
