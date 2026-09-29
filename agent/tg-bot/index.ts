// PepeLab Telegram 交易 agent：自然語言 → 在 session 限額內經 VC 授權上鏈開倉。
//
// 稽核 2026-08-06 修正：
//   A-2（Critical）舊版 `if (ALLOWED && chatId !== ALLOWED)` 在 TELEGRAM_ALLOWED_CHAT
//     留空時等於**對全世界開放下單**——任何知道 bot 名稱的人都能用 session key 上鏈
//     開真倉，直到預算用光，`/pos` 也對任何人吐 session 內容。現在此變數為**必填**，
//     未設就啟動失敗。
//   A-3（High）VC 從「有路徑才帶」改成必要：缺 VC 直接拒絕啟動，不可能靜默無授權下單。
//   Low  槓桿／保證金補上界；所有 sendMessage 都 await + catch（未攔截的 rejection
//     會讓 polling 程序整個掛掉）。
import fs from "node:fs";
import TelegramBot from "node-telegram-bot-api";

/** sendMessage 的選項型別（隨套件版本而異，這裡取其宣告以免版本升級就編不過）。 */
type SendMessageOptions = Parameters<TelegramBot["sendMessage"]>[2];
import { openPositionForSession, getSession, makeProvider, verifyAuthorizationVC, verifyAuthorizationVCWithProvider, type AuthorizationVC } from "@pepelab/shared";

function req(k: string, hint = ""): string {
  const v = process.env[k]?.trim();
  if (!v) {
    console.error(`✗ 缺少必要環境變數 ${k}${hint ? `\n  ${hint}` : ""}`);
    process.exit(1);
  }
  return v;
}

const TOKEN = req("TELEGRAM_BOT_TOKEN", "從 BotFather 取得後填入 agent/.env。");

// A-2：白名單必填。允許多個 chat id（逗號分隔），全部必須是整數（Telegram chat id
// 可為負數＝群組）。任何格式錯誤都在啟動時擋下，而不是執行期才發現放行了全世界。
const ALLOWED_CHATS = (() => {
  const raw = req(
    "TELEGRAM_ALLOWED_CHAT",
    "這個 bot 能用 session key 直接上鏈開真倉，因此**必須**指定允許的 chat id。\n" +
      "  取得方式：對 bot 傳任意訊息後開 https://api.telegram.org/bot<TOKEN>/getUpdates，\n" +
      "  取 message.chat.id。多個以逗號分隔，例如 TELEGRAM_ALLOWED_CHAT=123456789,-1001234567890",
  );
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const bad = ids.filter((s) => !/^-?\d+$/.test(s));
  if (bad.length) {
    console.error(`✗ TELEGRAM_ALLOWED_CHAT 含非法 chat id：${bad.join(", ")}（必須是整數）`);
    process.exit(1);
  }
  if (!ids.length) {
    console.error("✗ TELEGRAM_ALLOWED_CHAT 解析後為空。");
    process.exit(1);
  }
  return new Set(ids);
})();

const SESSION_ID = Number(process.env.DEMO_SESSION_ID ?? "0");
if (!Number.isInteger(SESSION_ID) || SESSION_ID < 0) {
  console.error(`✗ DEMO_SESSION_ID 非法：${process.env.DEMO_SESSION_ID}`);
  process.exit(1);
}

// 下單參數上界（第二道防線；合約的 session cap 才是最終約束，但明確的上界能在
// 打錯字時給出人看得懂的訊息，而不是丟一筆注定 revert 的交易上鏈燒 gas）。
const MAX_LEVERAGE = Number(process.env.TG_MAX_LEVERAGE ?? "5");
const MAX_MARGIN = Number(process.env.TG_MAX_MARGIN ?? "1000");
const MIN_MARGIN = Number(process.env.TG_MIN_MARGIN ?? "10");

// A-3：VC 必要。缺檔/壞檔/驗章失敗 → 啟動失敗（不進入「靜默無授權下單」狀態）。
const VC: AuthorizationVC = await (async () => {
  const p = req(
    "AGENT_AUTH_VC_PATH",
    "使用者簽發的授權 VC 路徑（前端 /sessions「Issue VC」匯出）。缺它就無法把下單歸因到簽發者。",
  );
  let parsed: AuthorizationVC;
  try {
    parsed = JSON.parse(fs.readFileSync(p, "utf8")) as AuthorizationVC;
  } catch (e) {
    console.error(`✗ 讀取/解析 VC 失敗(${p})：${(e as Error).message}`);
    process.exit(1);
  }
  // EOA 用 ecrecover；Base Account 等智慧帳戶簽的憑證用 ERC-1271 在鏈上驗章。
  let v = verifyAuthorizationVC(parsed);
  if (!v.valid) {
    try {
      v = await verifyAuthorizationVCWithProvider(parsed, makeProvider());
    } catch (e) {
      // 沒設 RPC 或 RPC 失敗：照樣拒絕啟動，訊息維持乾淨。
      v = { valid: false, reason: `${v.reason}；ERC-1271 驗章無法執行：${(e as Error).message}` };
    }
  }
  if (!v.valid) {
    console.error(`✗ VC 驗證失敗：${v.reason}（請重新在前端簽發）`);
    process.exit(1);
  }
  if (v.sessionId !== SESSION_ID) {
    console.error(`✗ VC sessionId(${v.sessionId}) 與 DEMO_SESSION_ID(${SESSION_ID}) 不符`);
    process.exit(1);
  }
  return parsed;
})();

const ASSETS: Record<string, string> = {
  btc:"sBTC",sbtc:"sBTC",eth:"sETH",seth:"sETH",aapl:"sAAPL",saapl:"sAAPL",tsla:"sTSLA",stsla:"sTSLA",
  nvda:"sNVDA",snvda:"sNVDA",msft:"sMSFT",smsft:"sMSFT",googl:"sGOOGL",goog:"sGOOGL",sgoogl:"sGOOGL",
  gold:"sGOLD",sgold:"sGOLD",bond:"sBOND",sbond:"sBOND",icln:"sICLN",sicln:"sICLN",esgu:"sESGU",sesgu:"sESGU",
};

function parseIntent(text: string) {
  const t = text.toLowerCase();
  let isLong: boolean | undefined;
  if (/(做多|看多|\blong\b|buy|買多|多單)/.test(t)) isLong = true;
  else if (/(做空|看空|\bshort\b|sell|放空|空單)/.test(t)) isLong = false;
  else if (/(^|\s)多(\s|$)/.test(t)) isLong = true;
  else if (/(^|\s)空(\s|$)/.test(t)) isLong = false;
  let symbol: string | undefined;
  for (const w of t.split(/[^a-z]+/)) if (ASSETS[w]) { symbol = ASSETS[w]; break; }
  const lev = t.match(/(\d+(?:\.\d+)?)\s*(?:x|倍)/) ?? t.match(/槓桿\s*(\d+(?:\.\d+)?)/);
  const leverage = lev ? Number(lev[1]) : undefined;
  const mg = t.match(/(?:保證金|margin)\s*(\d+(?:\.\d+)?)/) ?? t.match(/(\d+(?:\.\d+)?)\s*(?:usdt|usdc|u\b)/);
  const marginUsdc = mg ? Number(mg[1]) : undefined;
  return { isLong, symbol, leverage, marginUsdc };
}

/** 上界檢查：回錯誤字串代表拒絕。 */
export function checkBounds(leverage: number, marginUsdc: number): string | null {
  if (!Number.isFinite(leverage) || leverage < 1) return `槓桿必須 ≥ 1（收到 ${leverage}）`;
  if (!Number.isInteger(leverage)) return `槓桿必須是整數（收到 ${leverage}）`;
  if (leverage > MAX_LEVERAGE) return `槓桿 ${leverage}x 超過上限 ${MAX_LEVERAGE}x`;
  if (!Number.isFinite(marginUsdc) || marginUsdc <= 0) return `保證金非法（收到 ${marginUsdc}）`;
  if (marginUsdc < MIN_MARGIN) return `保證金 ${marginUsdc} 低於下限 ${MIN_MARGIN}`;
  if (marginUsdc > MAX_MARGIN) return `保證金 ${marginUsdc} 超過上限 ${MAX_MARGIN}`;
  return null;
}

const bot = new TelegramBot(TOKEN, { polling: true });
const HELP =
  "Mandate Layer 交易 agent。自然語言下單，例如：\n• 做多 sBTC 3x 保證金 50\n• 做空 sETH 槓桿2 保證金 40\n" +
  "指令：/pos 查 session ・ /help 說明\n" +
  `限額：槓桿 ≤ ${MAX_LEVERAGE}x、保證金 ${MIN_MARGIN}–${MAX_MARGIN}；另受 session 與 VC 約束，超過會被拒絕。`;

/** 所有對外送訊都必須 await + catch：未攔截的 rejection 會殺掉 polling 程序。 */
async function say(chatId: string, text: string, opts?: SendMessageOptions) {
  try {
    await bot.sendMessage(chatId, text, opts);
  } catch (e) {
    console.error(`sendMessage 失敗(chat ${chatId})：${(e as Error).message}`);
  }
}

bot.on("polling_error", (e) => console.error(`polling_error：${(e as Error).message}`));

bot.on("message", async (msg) => {
  const chatId = String(msg.chat.id);
  // A-2：白名單是唯一入口，未列入者連 /help 都不回（不洩漏 bot 存在與 session 內容）。
  if (!ALLOWED_CHATS.has(chatId)) {
    console.warn(`拒絕未授權 chat ${chatId}`);
    return;
  }
  const text = (msg.text ?? "").trim(); if (!text) return;
  if (text === "/start" || text === "/help") return void (await say(chatId, HELP));
  if (text === "/pos" || text === "/status" || text === "/session") {
    const r: any = await getSession(SESSION_ID);
    return void (await say(chatId, "```\n" + JSON.stringify(r, null, 2) + "\n```", { parse_mode: "Markdown" }));
  }
  const { isLong, symbol, leverage, marginUsdc } = parseIntent(text);
  const miss: string[] = [];
  if (isLong === undefined) miss.push("方向(做多/做空)");
  if (!symbol) miss.push("資產(如 sBTC)");
  if (!leverage) miss.push("槓桿(如 3x)");
  if (!marginUsdc) miss.push("保證金(如 保證金 50)");
  if (miss.length) return void (await say(chatId, `沒讀懂：缺 ${miss.join("、")}。範例：做多 sBTC 3x 保證金 50`));

  const bounds = checkBounds(leverage!, marginUsdc!);
  if (bounds) return void (await say(chatId, `❌ 超出限額：${bounds}`));

  await say(chatId, `收到 → ${isLong ? "做多" : "做空"} ${symbol}　${leverage}x　保證金 ${marginUsdc} USDT\n上鏈中…⏳`);
  try {
    const res: any = await openPositionForSession({
      sessionId: SESSION_ID, symbol: symbol!, isLong: isLong!,
      marginUsdc: marginUsdc!, leverage: leverage!, authVc: VC,
    });
    if (!res?.ok) return void (await say(chatId, `❌ 被拒絕：${res?.error ?? "未知錯誤"}`));
    const hash = res.txHash ?? res.hash ?? res.tx;
    await say(chatId, `✅ 已開倉\nposition #${res.positionId ?? "?"}\n${hash ? `https://sepolia.basescan.org/tx/${hash}` : "(無 tx hash)"}`);
  } catch (e) {
    await say(chatId, `❌ 失敗：${(e as Error).message}`);
  }
});

console.log(
  `Mandate Layer TG agent 上線。session #${SESSION_ID}，VC 已驗證，允許 chat：${[...ALLOWED_CHATS].join(", ")}。`,
);
