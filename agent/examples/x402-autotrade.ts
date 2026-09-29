// x402-autotrade.ts — 真正「用到 x402」的自主交易 agent。
//
// 流程（每一步都印 BaseScan 連結，鐵證 x402 真的驅動了下單）：
//   ① 用 x402 真實付費（官方 Base Sepolia USDC，402 → 簽 EIP-3009 → 200）向公開 API 買資料
//      - GET /oracle/<symbol> ($0.005)：拿價格 + funding + OI（決策依據）
//      - GET /signals/<trader> ($0.01) ：拿 settlementTx（API 70/20/10 收入上鏈的鐵證）
//   ② 依「x402 買到的資料」判斷方向：透明規則 funding ≤ 0 → 做多、funding > 0 → 做空
//      （funding > 0 = longs_pay，多方擁擠 → 反向做空；≤ 0 = shorts_pay/balanced → 做多）
//   ③ 用 session 在限額內 openPositionForSession 開倉，印開倉 tx + positionId
//
// 一次執行印出兩筆鏈上 tx：① x402 settlementTx、③ 開倉 tx —— 都能在 BaseScan 查到
// = x402 不是擺著沒用的側功能，而是真正驅動交易決策的一環。
//
// 重要前置 / 限制：
//   • x402 付款用「官方 Base Sepolia USDC」(Circle, EIP-3009)，**不是平台模擬 USDT**。
//     跑這支的 AGENT_PRIVATE_KEY 錢包必須有一點官方 USDC（Circle 測試網水龍頭）+ 一點 ETH 付 gas。
//   • 下單保證金仍是 session.user 在交易所存的（模擬 USDT）；兩種幣用途不同。
//   • 加密 sBTC/sETH 免 KYC；RWA（股票/債/ETF）需 user 先 KYC，否則開倉 revert。
//   • session 限額/到期由合約強制；用 #6 不會過期（到 2027-06-22，單筆≤50/預算1000/槓桿≤5）。
//
// 跑法（agent 目錄）：
//   設好 .env（見 agent/.env.example 的 Track D 段），然後：
//   npx tsx examples/x402-autotrade.ts <symbol> <margin> <leverage>   # 預設 sBTC 50 3
import { createWalletClient, http, publicActions, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { openPositionForSession } from "@pepelab/shared";
import { loadVc, verifyVcForAgent } from "./vc-gate.ts";
import { parseOracleBody } from "./x402-autonomous.ts";

const API = (process.env.X402_API_URL ?? "http://localhost:4021").replace(/\/$/, "");
const PK = process.env.AGENT_PRIVATE_KEY?.trim();
const RPC = process.env.BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";
// session id 是每個 manager 各自獨立的。本 repo 的 AgentSessionManager 是
// 0x71125e25…6CDe（mandate-layer 自己的部署）；session 由 create-session.sh 建立。
// 預設 X402_API_URL 指向本機 signal-api —— 不得付費或寫入原專案 pepelab_onchain_cfd 的服務。
const SESSION_ID = Number(process.env.DEMO_SESSION_ID ?? "0");

// 常見輸入正規化成鏈上資產代號（sBTC…）。
const ALIASES: Record<string, string> = {
  btc: "sBTC", sbtc: "sBTC", eth: "sETH", seth: "sETH",
  aapl: "sAAPL", tsla: "sTSLA", nvda: "sNVDA", msft: "sMSFT", googl: "sGOOGL",
  gold: "sGOLD", bond: "sBOND", icln: "sICLN", esgu: "sESGU",
};
const norm = (s: string) => ALIASES[s.toLowerCase()] ?? s;

const link = (h?: string) => (h ? `https://sepolia.basescan.org/tx/${h}` : "(無 tx hash)");

/** x402-fetch 成功付費後，回應帶 x-payment-response（base64 JSON），內含 facilitator
 *  結算這筆 USDC 付款的鏈上 tx —— 這是「真的付了 USDC」的 on-chain 證據。 */
function decodePaymentTx(res: Response): string | undefined {
  try {
    const h = res.headers.get("x-payment-response");
    if (!h) return undefined;
    const j = JSON.parse(Buffer.from(h, "base64").toString("utf8"));
    return j?.transaction ?? j?.txHash ?? undefined;
  } catch { return undefined; }
}

async function main() {
  const [, , symbolArg = "sBTC", marginArg = "50", levArg = "3"] = process.argv;
  const symbol = norm(symbolArg);
  const marginUsdc = Number(marginArg);
  const leverage = Number(levArg);

  if (!PK || !/^0x[0-9a-fA-F]{64}$/.test(PK)) {
    throw new Error("設 AGENT_PRIVATE_KEY=0x…（需持 Base Sepolia 官方 USDC + 一點 ETH）");
  }
  if (!process.env.SESSION_MANAGER_ADDRESS?.trim()) {
    throw new Error("設 SESSION_MANAGER_ADDRESS（AgentSessionManager 位址）");
  }
  const TRADER = process.env.TRADER?.trim() || privateKeyToAccount(PK as Hex).address;

  console.log(`\n=== x402-autotrade ===  ${symbol}  margin=${marginUsdc} USDT  ${leverage}x  session #${SESSION_ID}`);

  // ── 先免費探索服務目錄（端點/定價/network/asset），確認用真實欄位 ──
  const dir = await (await fetch(`${API}/`)).json().catch(() => ({}));
  console.log("\n探索 GET / →", JSON.stringify((dir as any)?.endpoints ?? dir));

  // ── 建 viem walletClient + x402 付費 fetch（遇 402 自動用官方 USDC 簽 EIP-3009 重送）──
  const account = privateKeyToAccount(PK as Hex);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) }).extend(publicActions);
  const payFetch = wrapFetchWithPayment(
    fetch,
    wallet as unknown as Parameters<typeof wrapFetchWithPayment>[1],
  );
  console.log("付款錢包（官方 USDC）：", account.address);

  // ── ① x402 付費取資料 ───────────────────────────────────────────────────────
  console.log(`\n① x402 付費 GET /oracle/${symbol} …（402 → 簽 EIP-3009 → 200）`);
  const oracleRes = await payFetch(`${API}/oracle/${symbol}`, { method: "GET" });
  const oracleBody = (await oracleRes.json().catch(() => null)) as any;
  console.log("   HTTP", oracleRes.status, "· 付款上鏈 tx:", link(decodePaymentTx(oracleRes)));

  // A-1 同類修正：錯誤 body 絕不可以被當成 oracle 資料。`funding` 缺值時舊版
  // `Number(undefined ?? 0)` = 0 → `0 <= 0` → **無條件做多**，等同對錯誤回應下單。
  const parsed = parseOracleBody(oracleBody, oracleRes.status);
  if (!parsed.ok) {
    console.error(`   ❌ oracle 回應不可用：${parsed.reason} → 不下單。`);
    console.error(`      原始 body：${JSON.stringify(oracleBody)?.slice(0, 300)}`);
    process.exit(1);
  }
  const data = parsed.data;
  console.log("   oracle 資料：", JSON.stringify(data));
  if (data.tradableNow === false) {
    console.error("   ❌ 鏈上價格已超過交易所 maxPriceAge（開倉會 revert StalePrice）→ 不下單。");
    process.exit(1);
  }

  console.log(`\n① x402 付費 GET /signals/${TRADER} …（取 70/20/10 收入結算 tx）`);
  const sigRes = await payFetch(`${API}/signals/${TRADER}`, { method: "GET" });
  const sigBody = (await sigRes.json().catch(() => null)) as any;
  console.log("   HTTP", sigRes.status);
  const settlementTx: string | undefined =
    sigRes.ok && sigBody?.ok !== false && typeof sigBody?.settlementTx === "string"
      ? sigBody.settlementTx
      : undefined;
  if (settlementTx) console.log(`   ✓ x402 settlementTx: ${link(settlementTx)}`);
  else console.log("   (server 未回 settlementTx — 結算可能未啟用；x402 付款仍已完成，見上方付款 tx)");

  // ── ② 依 x402 買到的資料判斷方向 ────────────────────────────────────────────
  // funding > 0 = longs_pay（多方擁擠）→ 反向做空；≤ 0 = shorts_pay/balanced → 做多。
  const fundingBps = data.fundingRateBps as number;
  const isLong = fundingBps <= 0;
  console.log(
    `\n② 依 funding=${fundingBps} bps（${data.fundingDirection ?? "?"}）→ ${isLong ? "做多 (long)" : "做空 (short)"}`,
  );

  // ── ③ session 在限額內開倉（A-3：必須帶使用者簽發的 VC）─────────────────────
  const vc = loadVc();
  const vcChk = await verifyVcForAgent(vc, account.address, SESSION_ID);
  console.log(`\nVC/SSI：${vcChk.ok ? "✓" : "✗"} ${vcChk.reason}` + (vcChk.issuerDid ? `（issuer ${vcChk.issuerDid}）` : ""));
  if (!vcChk.ok) {
    console.error("   ❌ 缺有效授權 VC（設 AGENT_AUTH_VC_PATH）→ 拒絕下單。");
    process.exit(1);
  }

  console.log(`\n③ openPositionForSession(session #${SESSION_ID}, ${symbol}, ${isLong ? "long" : "short"}, ${marginUsdc}, ${leverage}x, authVc) 上鏈中…⏳`);
  const res = await openPositionForSession({ sessionId: SESSION_ID, symbol, isLong, marginUsdc, leverage, authVc: vc! });
  if (!res.ok) {
    console.error(`   ❌ 開倉被拒：${res.error}`);
    process.exit(1);
  }
  console.log(`   ✓ 開倉 tx: ${link(res.txHash)}`);
  console.log(`   position #${res.positionId ?? "?"}`);

  // ── 總結：兩筆鏈上 tx ───────────────────────────────────────────────────────
  console.log("\n=== 鐵證（BaseScan 可查）===");
  if (settlementTx) console.log("① x402 settlementTx :", link(settlementTx));
  console.log("③ 開倉 tx          :", link(res.txHash));
  console.log("\n結論：agent 先付官方 USDC 買資料(x402) → 用 funding 決定方向 → 經 session 上鏈下單。");
}

main().catch((e) => {
  console.error("x402-autotrade 失敗：", e?.message ?? e);
  process.exit(1);
});
