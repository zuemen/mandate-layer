/**
 * Agent Mode 頁（/agent-mode）的字串。給評審用：不連錢包、不依賴後端，三分鐘看懂
 * agent 付了什麼錢、被授權多少、哪些交易被鏈上拒絕。資料全部直接讀鏈。
 */
export const agentMode = {
  title: 'Agent Mode',
  subtitle: 'AI agent 在鏈上做了什麼——全部直接從 Base Sepolia 讀，不需要連錢包。',
  howTitle: '四步驟看懂',
  how: [
    '使用者開一個有上限的 session，並簽一張 EIP-712 授權憑證（VC）給 agent。',
    'agent 用 x402 在 HTTP 層付 USDC 買訊號，錢直接進賣方地址。',
    'agent 只能在上限內下單；超額或撤銷之後，合約本身會拒絕。',
    '使用 Base Account 時，Base Spend Permission 還會限制每天最多有多少保證金能離開錢包，超過就由 Coinbase 的合約拒絕（見下方紀錄）。',
  ],
  refresh: '重新讀取',
  loading: '讀取鏈上資料中…',
  scanWindow: '掃描範圍：最近 {window}',
  readError: '讀取失敗：{error}',
  unreadable: '無法從鏈上讀取（見上方錯誤），請按重新整理。',

  payments: {
    title: 'x402 付費紀錄',
    caption: 'Circle USDC 從 agent 轉給訊號賣方 {seller} 的鏈上紀錄。每一筆都是一次 HTTP 402 付款。',
    empty: '掃描範圍內沒有付款紀錄。可以看下方「最近一次 demo 錄影」。',
    colFrom: '付款方（agent）',
    colAmount: '金額',
    colTx: '交易',
  },

  sessions: {
    title: 'Session 上限（鏈上強制）',
    caption: '每一個 session 都是使用者設定的硬上限，由 AgentSessionManager 在每筆下單時檢查。',
    empty: '還沒有任何 session。',
    colId: '#',
    colAgent: 'agent',
    colPerTrade: '單筆上限',
    colBudget: '已用 / 總預算',
    colLeverage: '槓桿上限',
    colExpiry: '到期',
    colStatus: '狀態',
    active: '有效',
    revoked: '已撤銷',
    expired: '已過期',
  },

  activity: {
    title: 'Agent 動作（session 事件）',
    empty: '掃描範圍內沒有 session 事件。',
    opened: '開倉 #{position}（保證金 {margin}）',
    closed: '平倉 #{position}',
    revoked: '使用者撤銷 session',
  },

  tryIt: {
    title: '現場測試：試著讓 agent 超額下單',
    caption:
      '用 eth_call 模擬 agent 從 session #{session} 下一筆保證金 {margin} 的單（上限 {cap}），或下一筆不在白名單上的資產。不會送出交易，也不需要私鑰——回傳的就是合約本身的拒絕理由。',
    button: '模擬超額下單',
    buttonAsset: '模擬白名單外資產下單',
    noSession: '需要至少一個 session 才能測試。',
    rejected: '合約拒絕：{reason}',
    noReason: '未提供原因',
    simulationFailed: '無法模擬這筆訂單（網路或 RPC 錯誤，不是合約拒絕）：{reason}',
    accepted: '合約沒有拒絕——這不應該發生，請回報。',
  },

  spendRun: {
    title: 'Base Account＋Spend Permission（錄好的示範）',
    inApp: '第 3、4 步在 App 裡是一顆按鈕，用你自己的 Base Account：',
    inAppLink: 'Agent Sessions 的「用 Base Account 替 agent 儲值」',
    inAppNoWallet: '連上錢包後，到 Agent Sessions 的「用 Base Account 替 agent 儲值」。',
    caption:
      'Base Account（Coinbase 智慧錢包）透過 Base Spend Permission 替 agent 儲值：每天最多 {allowance} mUSDC 能離開錢包，而且只能進它自己的保證金；session 再限制 agent 怎麼用這些錢。agent/examples/spend-permission-demo.ts 最近一次執行（{at}）。',
  },

  recorded: {
    title: '最近一次 demo 錄影（含被拒絕的交易）',
    caption:
      '被拒絕的交易不會產生事件，所以無法從日誌掃出來。這裡是 agent/examples/e2e-demo.ts 最近一次執行的紀錄（{at}），每一步都附 BaseScan 連結。',
    colStep: '步驟',
    colActor: '角色',
    colAction: '動作',
    colResult: '結果',
    colTx: '交易',
    offChain: '鏈下',
  },
};
