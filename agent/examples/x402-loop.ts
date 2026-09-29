// x402-loop.ts — 完全自主：每 INTERVAL 對一組資產各跑一次 Part B 決策。
// agent 看到平台(x402)資料後完全自主操作：付費買資料 → 自己判斷 long/short/skip → 該進才下單。
//
// 冷卻：同資產若「已有未平倉部位」或「N 分鐘內已開過」→ 跳過，避免重複堆倉。
// 每輪印摘要：時間、各資產 edge、決策、tx（若有）。
//
// CLI：npx tsx examples/x402-loop.ts            # 用 env 的 ASSETS / INTERVAL_MIN
// 掛法（見 examples/x402-loop.md）：node 常駐 / pm2 / 系統 cron / GitHub Actions 定時。
//
// env：ASSETS=sBTC,sETH ・ INTERVAL_MIN=15 ・ COOLDOWN_MIN=30 ・ LOOP_MARGIN=50 ・ LOOP_LEVERAGE=3
// 限制同 x402-autonomous（官方 USDC 付費、模擬 USDT 保證金、RWA 需 KYC）。
import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import {
  openPositionForSession, getSession, makeProvider, makeContracts, assetIdOf,
  agentDid, appendAudit, type AuditRecord, type AuthorizationVC,
} from "@pepelab/shared";
import { decide, parseOracleBody } from "./x402-autonomous.ts";
import { loadVc, verifyVcForAgent, fetchAgentVerification, AUDIT_PATH, type VcCheck } from "./vc-gate.ts";

const API = (process.env.X402_API_URL ?? "http://localhost:4021").replace(/\/$/, "");
const PK = process.env.AGENT_PRIVATE_KEY?.trim();
const RPC = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
// session id 是每個 manager 各自獨立的。本 repo 的 AgentSessionManager 是
// 0x71125e25…6CDe（mandate-layer 自己的部署）；session 由 create-session.sh 建立。
// 預設 X402_API_URL 指向本機 signal-api —— 不得付費或寫入原專案 pepelab_onchain_cfd 的服務。
const SESSION_ID = Number(process.env.DEMO_SESSION_ID ?? "0");
const ASSETS = (process.env.ASSETS ?? "sBTC,sETH").split(",").map((s) => s.trim()).filter(Boolean);
const INTERVAL_MS = Number(process.env.INTERVAL_MIN ?? "15") * 60_000;
const COOLDOWN_MS = Number(process.env.COOLDOWN_MIN ?? "30") * 60_000;
const LOOP_MARGIN = Number(process.env.LOOP_MARGIN ?? "50");
const LOOP_LEVERAGE = Number(process.env.LOOP_LEVERAGE ?? "3");
// 每次 /oracle 呼叫的 x402 單價（與 server 的 PRICE_ORACLE 一致）。
const ORACLE_PRICE_USDC = Number(process.env.X402_ORACLE_PRICE ?? "0.005");
// 稽核（四·Medium）：舊版 `for(;;)` 無限迴圈、每輪對每個資產先付費再判斷要不要
// 跳過（192 次付費/日、無累計上限、失敗也永遠重試）。以下三道閘門把「自主」限制在
// 一個有界、可觀測的預算內。
const MAX_SPEND_USDC = Number(process.env.LOOP_MAX_SPEND_USDC ?? "1");     // 累計資料費上限
const MAX_ROUNDS = Number(process.env.LOOP_MAX_ROUNDS ?? "0");            // 0 = 不限輪數
const MAX_CONSECUTIVE_FAILURES = Number(process.env.LOOP_MAX_FAILURES ?? "5");

let spentUsdc = 0;          // 已花掉的 x402 資料費（累計）
let consecutiveFailures = 0; // 連續整輪失敗次數

const link = (h?: string) => (h ? `https://sepolia.basescan.org/tx/${h}` : "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lastOpened: Record<string, number> = {};

function decodePaymentTx(res: Response): string | undefined {
  try {
    const h = res.headers.get("x-payment-response");
    if (!h) return undefined;
    return JSON.parse(Buffer.from(h, "base64").toString("utf8"))?.transaction;
  } catch { return undefined; }
}

/** 鏈上是否已有該資產的未平倉部位（session.user）。 */
async function hasOpenPosition(user: string, symbol: string): Promise<boolean> {
  try {
    const c = makeContracts(makeProvider());
    const assetId = assetIdOf(symbol).toLowerCase();
    const ids = (await c.perp.getUserPositions(user)) as bigint[];
    for (const id of ids) {
      const p: any = await c.perp.getPosition(id);
      if (p?.isOpen && String(p.asset).toLowerCase() === assetId) return true;
    }
  } catch { /* 讀取失敗就當沒有，交給合約把關 */ }
  return false;
}

interface RoundCtx {
  payFetch: typeof fetch; sessionUser: string; det: any;
  vc: AuthorizationVC | null; vcChk: VcCheck; agentAddress: string;
  agentVerification: { overallRiskScore: number; riskTier: string } | null;
}

/** 每資產：先判斷該不該花錢 → 付費研究 → 寫一筆稽核 → 有效 VC + 決策才開倉。
 *  回傳本輪是否至少有一個資產順利完成（用來判斷連續失敗）。 */
async function runRound(ctx: RoundCtx): Promise<boolean> {
  const { payFetch, sessionUser, det, vc, vcChk, agentAddress, agentVerification } = ctx;
  console.log(`\n──────── ${new Date().toISOString()} ────────`);
  let anySuccess = false;
  for (const symbol of ASSETS) {
    const rec: AuditRecord = {
      ts: new Date().toISOString(), issuerDid: vcChk.issuerDid, agentDid: agentDid(agentAddress),
      sessionId: SESSION_ID, vc: { id: vcChk.id, expiry: vcChk.expiry, verified: vcChk.ok, reason: vcChk.reason },
      research: { resource: `/oracle/${symbol}`, priceUsdc: String(ORACLE_PRICE_USDC), settlementTx: null },
      decision: { edgeScore: null, side: "skip", reason: "" },
      action: { opened: false, positionId: null, txHash: null }, agentVerification,
    };
    try {
      // ── 付費**之前**先問「這筆資料就算買了也用不上嗎？」──────────────────
      // 舊版順序相反：先付 0.005 USDC，拿到資料才發現在冷卻中／已有部位，
      // 一天 192 次白花錢。買不會影響決策的資料，本身就是決策錯誤。
      if (lastOpened[symbol] && Date.now() - lastOpened[symbol] < COOLDOWN_MS) {
        rec.decision.reason = `冷卻中（${COOLDOWN_MS / 60000} 分內已開過）→ 不付費研究`;
        console.log(`  ${symbol}: 冷卻中，跳過（未付費）`);
        appendAudit(AUDIT_PATH, rec); anySuccess = true; continue;
      }
      if (await hasOpenPosition(sessionUser, symbol)) {
        rec.decision.reason = "已有未平倉部位 → 不付費研究";
        console.log(`  ${symbol}: 已有部位，跳過（未付費）`);
        appendAudit(AUDIT_PATH, rec); anySuccess = true; continue;
      }
      if (!vcChk.ok) {
        rec.decision.reason = `VC 無效（${vcChk.reason}）→ 不可能下單，故不付費研究`;
        console.log(`  ${symbol}: VC 無效，跳過（未付費）`);
        appendAudit(AUDIT_PATH, rec); anySuccess = true; continue;
      }
      if (spentUsdc + ORACLE_PRICE_USDC > MAX_SPEND_USDC) {
        rec.decision.reason = `已達累計資料費上限（${spentUsdc.toFixed(3)}/${MAX_SPEND_USDC} USDC）`;
        console.log(`  ${symbol}: 已達花費上限，跳過（未付費）`);
        appendAudit(AUDIT_PATH, rec); anySuccess = true; continue;
      }

      const res = await payFetch(`${API}/oracle/${symbol}`, { method: "GET" });
      spentUsdc += ORACLE_PRICE_USDC;
      const body = await res.json().catch(() => null);
      rec.research.settlementTx = decodePaymentTx(res) ?? null;
      const payTx = rec.research.settlementTx ?? undefined;

      // A-1 同類修正：錯誤 body 不得成為決策輸入。
      const parsed = parseOracleBody(body, res.status);
      if (!parsed.ok) {
        rec.decision.reason = `資料不可用 → skip（${parsed.reason}）`;
        console.log(`  ${symbol}: 資料不可用（${parsed.reason}）→ skip　[x402 ${link(payTx)}]`);
        appendAudit(AUDIT_PATH, rec); continue;
      }
      const data = parsed.data;
      rec.decision.edgeScore = data.edgeScore ?? null;

      const dec = decide({
        data, wantMargin: LOOP_MARGIN, wantLeverage: LOOP_LEVERAGE,
        sessionMaxPerTrade: Number(det.maxMarginPerTrade ?? 0),
        sessionRemainingBudget: Number(det.totalMarginBudget ?? 0) - Number(det.spentMargin ?? 0),
        sessionMaxLev: Number(det.maxLeverage ?? 5),
        httpStatus: res.status,
      });
      rec.decision.side = dec.action; rec.decision.reason = dec.reason;
      anySuccess = true;

      if (dec.action === "skip") {
        console.log(`  ${symbol}: edge=${data.edgeScore} → skip（${dec.reason}）　[x402 ${link(payTx)}]`);
      } else {
        const isLong = dec.action === "long";
        const r = await openPositionForSession({ sessionId: SESSION_ID, symbol, isLong, marginUsdc: dec.margin!, leverage: dec.leverage!, authVc: vc! });
        if (r.ok) {
          lastOpened[symbol] = Date.now();
          rec.action = { opened: true, positionId: r.positionId ?? null, txHash: r.txHash ?? null };
          console.log(`  ${symbol}: edge=${data.edgeScore} → ${dec.action} ✓ #${r.positionId ?? "?"}　開倉 ${link(r.txHash)}　[x402 ${link(payTx)}]`);
        } else {
          rec.decision.reason += `；開倉被拒：${r.error}`;
          console.log(`  ${symbol}: ${dec.action} 被拒：${r.error}`);
        }
      }
    } catch (e) {
      rec.decision.reason = `本輪失敗 — ${(e as Error).message}`;
      console.log(`  ${symbol}: 本輪失敗 — ${(e as Error).message}`);
    }
    appendAudit(AUDIT_PATH, rec);
  }
  console.log(`  （累計 x402 資料費 ${spentUsdc.toFixed(3)} / ${MAX_SPEND_USDC} USDC）`);
  return anySuccess;
}

async function main() {
  if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) throw new Error("設 AGENT_PRIVATE_KEY=0x…（需持官方 USDC + ETH）");
  if (!process.env.SESSION_MANAGER_ADDRESS?.trim()) throw new Error("設 SESSION_MANAGER_ADDRESS");

  const account = privateKeyToAccount(PK as Hex);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) }).extend(publicActions);
  const payFetch = wrapFetchWithPayment(fetch, wallet as unknown as Parameters<typeof wrapFetchWithPayment>[1]) as unknown as typeof fetch;

  const first: any = await getSession(SESSION_ID);
  console.log(`x402-loop 上線。session #${SESSION_ID}（user ${first?.detail?.user ?? account.address}）・資產 [${ASSETS.join(", ")}]・每 ${INTERVAL_MS / 60000} 分・冷卻 ${COOLDOWN_MS / 60000} 分。`);
  console.log(
    `上限：累計資料費 ≤ ${MAX_SPEND_USDC} USDC・` +
      `輪數 ${MAX_ROUNDS > 0 ? MAX_ROUNDS : "不限"}・連續失敗 ${MAX_CONSECUTIVE_FAILURES} 次即停。稽核 → ${AUDIT_PATH}`,
  );

  // 立即跑一輪，之後每 INTERVAL 重複（完全自主，但有界）。
  // 稽核（四·Medium）：session 額度與 VC 以前**只在啟動時讀一次**，於是使用者中途
  // 撤銷 session／VC 過期／預算被用掉，長跑中的 agent 完全看不到，會拿著已作廢的
  // 授權繼續下單（最終被合約 revert，但那是靠鏈上兜底，不是 agent 有在遵守）。
  // 現在每一輪都重新讀鏈上 session 並重驗 VC。
  for (let round = 1; MAX_ROUNDS <= 0 || round <= MAX_ROUNDS; round++) {
    if (spentUsdc >= MAX_SPEND_USDC) {
      console.log(`\n已達累計資料費上限（${spentUsdc.toFixed(3)}/${MAX_SPEND_USDC} USDC）→ 停止。`);
      break;
    }

    // 每輪重讀 session 額度（撤銷/到期/預算用罄立即反映）。
    const s: any = await getSession(SESSION_ID);
    const det = s?.detail ?? {};
    const sessionUser = det.user ?? account.address;
    if (!s?.ok) {
      consecutiveFailures += 1;
      console.error(`\n讀取 session 失敗（${s?.error ?? "unknown"}）—— 連續失敗 ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`);
    } else if (det.revoked) {
      console.error(`\nsession #${SESSION_ID} 已被使用者撤銷 → 停止（不再嘗試下單）。`);
      break;
    } else if (Number(det.expiry ?? 0) * 1000 < Date.now()) {
      console.error(`\nsession #${SESSION_ID} 已到期 → 停止。`);
      break;
    } else {
      // 每輪重驗 VC（可能已過期，或使用者換發了新的一張）。
      const vc = loadVc();
      const vcChk = await verifyVcForAgent(vc, account.address, SESSION_ID);
      if (!vcChk.ok) console.warn(`VC/SSI：✗ ${vcChk.reason} → 本輪只研究、拒絕下單`);
      const agentVerification = await fetchAgentVerification(API, agentDid(account.address)); // E3
      const ctx: RoundCtx = { payFetch, sessionUser, det, vc, vcChk, agentAddress: account.address, agentVerification };
      const okRound = await runRound(ctx);
      consecutiveFailures = okRound ? 0 : consecutiveFailures + 1;
    }

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`\n連續 ${consecutiveFailures} 輪失敗 → 停止（避免無止境重試燒錢/被限流）。`);
      process.exit(1);
    }
    await sleep(INTERVAL_MS);
  }
  console.log("x402-loop 結束（達到輪數/花費上限）。");
}

main().catch((e) => { console.error("x402-loop 失敗：", e?.message ?? e); process.exit(1); });
