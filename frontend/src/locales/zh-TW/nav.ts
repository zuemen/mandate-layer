/**
 * 側邊欄、手機選單、搜尋列與帳戶選單的項目名稱。
 *
 * emoji 留在字串裡，不另外抽成欄位：nav 元件把 `title` 當成一段文字渲染，抽出來就得
 * 給每個項目加一個欄位並改元件。留在 catalog 值裡的另一個好處是譯者看得到它、能決定
 * 英文版要不要保留——emoji 在不同語言的觀感並不一致。
 */
export const nav = {
  section: {
    pepelab: 'Mandate Layer',
    trader: '交易者',
  },
  item: {
    portfolio: '🏠 投資組合',
    pepe: '🎮 養成中心',
    exchange: '入金與兌換',
    tokens: '🪙 資產',
    terminal: '專業終端（進階）',
    x402: 'x402 訊號 API',
    marketplace: '交易市集',
    vault: '保險金庫',
    history: '歷史記錄',
    whale: '鯨魚追蹤',
    esg: 'ESG',
    rewards: '獎勵 🎁',
    sessions: '🤖 Agent 委任',
    agentMonitor: '📊 Agent 監控',
    agentMode: '🤖 Agent Mode',
    traderDashboard: '交易者主頁',
    stake: '質押',
  },
  account: {
    profile: '個人首頁',
    potions: '魔法藥水商店',
    mounts: '尊貴坐騎',
    skins: '🎰 造型盲盒與商城',
    staking: '跟單質押',
    rewards: '🎁 每日激勵',
  },
};
