# Mandate Layer — Telegram 交易 agent

> ⚠️ **Inherited from the pre-contest capstone project.** Contract addresses and session ids in this file refer to the capstone deployment, not to the contest deployment. Current addresses: `frontend/src/contracts/addresses.ts` and the main README. Do not send transactions to the addresses below.

在 Telegram 用自然語言下單，bot 憑授權 VC 在 session 限額內上鏈開倉（Base Sepolia）。

1. **填 `agent/.env`**（複製 `agent/.env.example`）：`TELEGRAM_BOT_TOKEN`（BotFather）、`AGENT_PRIVATE_KEY`（你的 agent session key）、`TELEGRAM_ALLOWED_CHAT`（你的 chat id）、`DEMO_SESSION_ID`、`SESSION_MANAGER_ADDRESS`、`BASE_SEPOLIA_RPC_URL`。
2. **存授權 VC**：在前端 `/sessions` 對該 session「Issue VC」→ 把 JSON 存成 `agent/tg-bot/vc.json`（`AGENT_AUTH_VC_PATH` 預設指向它；已 gitignore）。
3. **啟動**：`cd agent && npx tsx tg-bot/index.ts`，然後在 Telegram 對 bot 打「**做多 sBTC 3x 保證金 50**」。

> session id 是每個 manager 各自獨立的。新的 AgentSessionManager `0x4E7cC1B7…`（有資產白名單）目前只有 **#0**：到期 2027-07、單筆≤1000/預算3000/槓桿≤5、白名單 sBTC+sETH。`#6` 只存在於舊的 `0x5Ebcc64C…`（無資產白名單）。設 `DEMO_SESSION_ID=0`。

指令：`/help` 說明、`/pos` 查 session 限額。下單超過 session 的單筆/總額/槓桿上限會被合約 revert，bot 會回傳原因。私鑰與 VC 只放本機，**勿入庫、勿外流**。
