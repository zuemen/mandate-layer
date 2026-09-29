import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/common.ts`。
 */
export const common: Catalog['common'] = {
  /** 錢包連線視窗。 */
  wallet: {
    dialogTitle: 'Connect Wallet',
    closeAria: 'Close wallet connection dialog',
    intro: 'Choose your sign-in channel to enter Mandate Layer on Base Sepolia.',

    metamaskTitle: 'Connect with MetaMask',
    metamaskDesc: 'Connect via the MetaMask browser extension (Base Sepolia)',
    installMetamask: 'Install the MetaMask extension ↗',

    mockTitle: 'Pepe Demo Channel (Mock Web3)',
    mockDesc: 'No wallet needed — jump straight in, switch Pepe avatars, and try copy trading',
  },

  /** 確認對話框的預設按鈕文字，呼叫端可以各自覆寫。 */
  dialog: {
    cancel: 'Cancel',
    confirm: 'Confirm',
  },

  paperTrading: {
    tooltip:
      "This platform runs on a testnet — every asset and balance is simulated, no real money involved. Equivalent to TradingView's Paper Trading mode.",
    compactLabel: 'PAPER TRADING',
    label: 'PAPER TRADING · Simulated testnet trading',
  },

  avatarPicker: {
    title: 'Choose an avatar',
  },

  layout: {
    skipToContent: 'Skip to main content',
    expertHint: 'Switch to Expert Mode to see all {count} features →',
    simple: 'Simple',
    expert: 'Expert',
    toExpertAria: 'Switch to Expert Mode',
    toSimpleAria: 'Switch to Simple Mode',

    /** #36：網路不符的橫幅，句中夾了兩段 `<b>`。 */
    networkMismatch: {
      before: 'Currently connected to ',
      mid: '. The chain this app is deployed on is ',
      primaryBefore: 'Base Sepolia (',
      primaryAfter: ')',
      after: ' — trading, agent sessions, and x402 only work there.',
      sepoliaExtra: ' Sepolia is kept around for the tokenized-assets and V2 vault demos.',
    },
  },

  account: {
    displayNameLabel: 'Display Name',
    saveName: 'Save Name',
  },

  /**
   * 交易者等級。zh-TW 是「英文 中文」的雙語形式——英文那一半是排行榜與合約事件裡用
   * 的名字，中文那一半是給讀者的說明。en 版讀者已經看得懂那個英文名字本身，不需要
   * 再翻出第二份說明，所以就是單一個字。
   */
  tier: {
    diamond: 'Diamond',
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
  },

  /** x402 結算用的 Circle 官方 USDC。發行方名字是和平台模擬幣唯一的區別，不可省略。 */
  x402StableLabel: 'Circle USDC',

  /**
   * 通知鈴鐺的固定示範內容。每則拆成 `{text, bold?}` 片段陣列而不是 HTML 字串——
   * `notification-item.tsx` 曾經用 `dangerouslySetInnerHTML` 直接塞 `<p><strong>…`，
   * 那等於把標記存進資料而不是畫面結構，#26 不允許。片段陣列讓組件自己決定怎麼
   * 排版，catalog 只放純文字。
   *
   * #38：`GigaPepe 🦾`、`Elon Frog 🚀`、`@Jaydon Frankie` 這類虛構使用者代稱不翻譯——
   * 它們是特定帳號的識別名，性質上與 ADR-0002 的協定/產品專有名詞同一類（翻譯
   * 使用者自己取的名字等於改名，不是在地化），不是漏翻。
   */
  notification: {
    friendRequestBold: 'GigaPepe 🦾',
    friendRequestAfter: ' sent you a copy-trade follow request!',

    pairedBold1: 'Elon Frog 🚀',
    pairedMid: ' paired with you! You both earned ',
    pairedBold2: '200 PEPE',
    pairedAfter: ' copy rewards! 🤝',

    potionBefore: '🧪 Your ',
    potionBold: 'Golden Elixir',
    potionAfter: ' purchase was successful! (-300 PEPE)',

    skinBefore: '👑 Outfit changed! You just equipped the latest ',
    skinBold: 'Astronaut Suit',
    skinAfter: ' look!',

    whaleAlertBefore: '💰 ',
    whaleAlertBold1: 'Whale Alert',
    whaleAlertMid: ': A copy whale just locked ',
    whaleAlertBold2: '$50,000 USDC',
    whaleAlertAfter: ' to follow your strategy!',

    checkinBefore: '📅 ',
    checkinBold1: 'Daily check-in reminder',
    checkinMid: ": you haven't checked in today! Tap to claim today's ",
    checkinBold2: '+50 PEPE',
    checkinAfter: ' bonus!',

    tierUpBefore: '📈 Your trading volume crossed a tier threshold and unlocked ',
    tierUpBold: 'Gold 🥇',
    tierUpAfter: ' tier, plus a one-time 10,000 PEPE reward!',

    miningBefore: '⛏️ Your leveraged open positions have accumulated ',
    miningBold: '4,200 PEPE',
    miningAfter: ' in trade-mining rewards, ready to claim!',

    vaultRebalancedBefore: '🛡️ ',
    vaultRebalancedBold: 'Insurance Vault',
    vaultRebalancedAfter: ' has fully rebalanced! Platform risk index is extremely low & SAFU.',

    /** 專案協作卡片示範用的固定內容（非 PepeFi 特有，沿用範本情境）。 */
    projectFeedbackBold: '@Jaydon Frankie',
    projectFeedbackAfter: ' feedback by asking questions or just leave a note of appreciation.',
  },
};
