/**
 * AI Agent Sessions：委派一把有界的 session key 給 agent。
 *
 * 匯出的 MCP 設定裡那句提示是例外：它是 JSON 值，會被整段複製進別人的
 * 設定檔，但它本身是給人讀的句子而不是語法，所以進 catalog。
 */
export const sessions = {
  title: '🤖 AI Agent 委任',
  viewOn: '在 {explorer} 查看 ↗',

  ssi: {
    title: 'SSI 三角：你的錢包就是信任根',
    flow: '流程：連錢包 → 設限額建 session → 簽發授權 VC → 一鍵匯出 agent 設定 → 之後只下口頭交易意圖。',
  },

  wrongNetwork: {
    title: '請切換到 Base Sepolia（chainId 84532）',
    unknownChain: '未知網路',
  },

  create: {
    title: '建立 Session',
    agentAddress: 'Agent 地址（session key）',
    agentPlaceholder: '0x… 或按右側「產生 agent 金鑰」',
    generateKey: '產生 agent 金鑰',
    maxPerTrade: '單筆上限（USDC）',
    totalBudget: '總預算（USDC）',
    maxLeverage: '最大槓桿',
    validFor: '有效期限（小時）',
    creating: '建立中…',
    cta: '建立 Session',
    done: 'Session 已建立 ✓',
  },

  /** 瀏覽器裡產生的一次性 burner 金鑰。 */
  key: {
    title: '🔑 你的 agent 專用金鑰（burner）',
    clear: '清除',
    addressChip: '地址（會上鏈授權）',
    privateKeyChip: '私鑰（只放本機）',
    /** 私鑰被遮住時，圓點後面接的那一段字。 */
    hiddenSuffix: ' （已隱藏）',
    reveal: '顯示',
    hide: '隱藏',
    copy: '複製',
    copyAddressLabel: 'Agent 地址',
    copyPrivateKeyLabel: 'Agent 私鑰',
    generated: '已產生 agent 專用金鑰（只在本機瀏覽器，請立即保存）',
  },

  list: {
    title: '我的 Session',
    refresh: '↺ 重新整理',
    loading: '載入中…',
    empty: '尚無 session。建立一個來授權 agent。',

    column: {
      id: '#',
      agent: 'Agent',
      spent: '花費 / 預算',
      maxPerTrade: '單筆上限',
      leverage: '槓桿',
      expiry: '到期',
      status: '狀態',
      credential: '憑證',
    },

    status: {
      revoked: '已撤銷',
      expired: '已過期',
      active: '進行中',
    },

    issued: '已核發 ✓',
    export: '匯出 ⤓',
    issueVc: '核發 VC',
    signing: '簽署中…',
    issueVcHint: 'MetaMask 簽發授權 VC',
    issueVcNeedsWallet: '需真實錢包簽署（mock 模式不支援）',
    revoke: '撤銷',
    revoked: 'Session 已撤銷 ✓',
    credentialIssued: '憑證已核發 ✓',
    needsRealWallet: '需連接真實錢包以簽署 VC（mock 模式不支援簽章）',
  },

  /** Base Account＋Base Spend Permission 一次批次設定（EIP-5792）。 */
  baseAccount: {
    title: '用 Base Account 替 agent 儲值',
    intro:
      '使用 Base Account（Coinbase 智慧錢包）時，一筆批次會：核准給我們 funder 的 Base Spend Permission、把上面填的 agent 設為儲值 agent、用上面的上限開一個 session（資產 sBTC、sETH）。Spend Permission 限制每天最多有多少保證金能離開錢包；session 限制 agent 怎麼用這些錢。',
    dailyAllowance: '每日額度（mUSDC）',
    cta: '用一筆 Base Account 批次完成設定',
    sending: '等待錢包確認…',
    checking: '正在檢查連線的帳戶…',
    smart: '偵測到 Coinbase 智慧錢包。',
    smartAddOwner: '偵測到 Coinbase 智慧錢包。批次會先把 SpendPermissionManager 加為 owner（Spend Permission 需要）。',
    undeployed: '這個錢包支援批次呼叫；Base Account 會在這筆批次中建立。',
    notSmart: '這是一般錢包（EOA）。Spend Permission 需要 Base Account（Coinbase 智慧錢包）。',
    notCoinbase: '這個帳戶是合約，但不是 Coinbase 智慧錢包，Spend Permission 無法動用它的資金。',
    readFailed: '讀不到這個帳戶在 Base Sepolia 上的資料。',
    retry: '重試',
    rejected: '你在錢包裡拒絕了這個請求，沒有送出任何東西。',
    badHours: '請先把上方的「有效期限（小時）」設成超過一分鐘（例如 1）。',
    wrongChain: '請切換到 Base Sepolia：funder 部署在那裡。',
    needAgent: '請先在上方填入 agent 地址。',
    unsupported: '你的錢包不支援 wallet_sendCalls（EIP-5792）。請使用 Base Account 或 Coinbase Wallet。',
    done: '完成：Spend Permission 已核准、session 已開啟。請在下方列表替它簽授權憑證，再把憑證和這份 Spend Permission 交給 agent。',
    failed: '批次失敗：{reason}',
    timeout: '已送出，但 90 秒內尚未確認。請查看錢包；上鏈後 session 列表會自動更新。',
    noSpmOwner:
      '你的 Base Account 建立時沒有把 SpendPermissionManager 設為 owner，agent 暫時還不能使用這份 Spend Permission。按下面的按鈕，由你的帳戶送一筆呼叫把它加上；不會另開 session。',
    addOwnerCta: '把 SpendPermissionManager 加為 owner',
    ownerPending: '還差一步：要先把 SpendPermissionManager 加為這個帳戶的 owner，agent 才能使用 Spend Permission（見下方）。',
    spmOwnerUnknown: '還無法確認新的 Base Account 是否已把 SpendPermissionManager 列為 owner；列為 owner 之後，agent 的儲值才會成功。',
    ownerUnknownStatus: '還差一項確認：SpendPermissionManager 是否已是這個帳戶的 owner（見下方）。',
    checkAgain: '再檢查一次',
    reading: '讀取中…',
    fixDone: 'SpendPermissionManager 已是這個帳戶的 owner，agent 可以使用下方的 Spend Permission。',
    fixTimeout: '已送出，但 90 秒內尚未確認。請等錢包顯示已確認後重新整理頁面，卡片會重新讀取帳戶。',
    permissionLabel: '給 agent 的 Spend Permission（top_up_margin 用）',
    copy: '複製',
    balance: '這個帳戶的 mUSDC：{amount}。agent 只能儲值帳戶裡實際有的保證金。',
    recordedRun: 'Base Sepolia 上的實跑紀錄',
  },

  /** 匯出對話框。 */
  export: {
    title: '🔌 連接你的 Agent — Session #{id}',
    close: '關閉',
    closeAria: '關閉',
    intro:
      '把以下兩份貼進你本機的 agent client，之後只需下「口頭交易意圖」，agent 會在 session 限額內憑 VC 代你下單：',

    mcpTitle: 'MCP 設定（Claude Desktop / Code）',
    vcTitle: '授權 VC（下單驗證用）',
    copy: '複製',
    download: '下載 .json',
    copyMcpLabel: 'MCP 設定',
    copyVcLabel: '授權 VC',

    /** 匯出的 MCP 設定裡，私鑰欄位的預設佔位提示。 */
    privateKeyPlaceholder: '0x...   # 貼上你剛產生/保存的 agent 私鑰（放本機，勿外流）',
  },

  copied: '{label} 已複製 ✓',
  copyFailed: '複製失敗（瀏覽器剪貼簿權限）',

  sessionManager: 'AgentSessionManager: {address}',

  /** 交易正在跑的時候按鈕上的字。 */
  working: '…',

  /** #36：十段句中夾標記的說明，各自拆成標記前後的片段。 */
  markup: {
    introBefore:
      '委派一把有界 session key 給 agent：限單筆保證金、總預算、最大槓桿與到期。 Agent 只能在限額內經 AgentSessionManager 代你開/平倉，永不持有你的主錢包私鑰。 每個 agent 具 ',
    introMid: ' 身分，授權可憑證化為 ',
    introAfter: ' 供下單前驗簽 （SSI / 可驗證自主交易，見 docs/AGENT_IDENTITY_VC_SSI.md）。',

    roleIssuerBefore: '🖊️ ',
    roleIssuerBold: 'Issuer＝你',
    roleIssuerAfter: '：用 MetaMask 簽發授權 VC（私鑰不離開錢包）',
    roleHolderBefore: '🤖 ',
    roleHolderBold: 'Holder＝agent',
    roleHolderAfter: '：持 VC + session key 代你下單',
    roleVerifierBefore: '✅ ',
    roleVerifierBold: 'Verifier＝MCP/合約',
    roleVerifierAfter: '：下單前驗簽 + 鏈上 session 交叉比對',

    wrongNetBefore: 'AI Agent Sessions 部署在 ',
    wrongNetMid: ' 測試網。你目前連到的是',
    wrongNetAfter: '，請在 MetaMask 切換到 Base Sepolia 後重整本頁。',

    keyNoteBold1: 'agent 用一把獨立的 session key，不是你的主錢包',
    keyNoteMid1: '：',
    keyNoteBold2: '地址',
    keyNoteMid2: ' → 拿來授權下面這個 session；',
    keyNoteBold3: '私鑰',
    keyNoteAfter:
      ' → 放進 agent 的 MCP 設定 + 一點 ETH 付 gas。 沒有現成的就按「產生 agent 金鑰」在瀏覽器產生一把全新 burner。',

    burnerWarnBefore: '這是一把獨立的 burner 金鑰，只受你下面設的 session 限額拘束。請存到本機 agent 設定，',
    burnerWarnBold: '別放主錢包資產',
    burnerWarnAfter: '。本頁只顯示這一次，且不會上傳或寫入伺服器。',

    step1Before: '把 ',
    step1Bold: 'MCP 設定',
    step1Mid1: '貼進 Claude Desktop/Code 的 ',
    step1Mid2: '，並把 ',
    step1After: ' 換成你本機 agent 的 session key。',
    step2Before: '把 ',
    step2Bold: '授權 VC',
    step2Mid1: '存成檔案，agent 下單時以 ',
    step2Mid2: ' 指向它（或 MCP ',
    step2Mid3: ' 的 ',
    step2After: '）。',
    step3: '完成後直接對 agent 說：「幫我用 3x 槓桿做多 sBTC、保證金 200」即可，無需再報帳號/位址。',

    addrKeyBold1: '地址',
    addrKeyMid1: '（',
    addrKeyMid2: '）＝已上鏈授權的 agent，放在 session / VC 裡；',
    addrKeyBold2: '私鑰',
    addrKeyAfter: '＝對應這個地址、只放本機 agent 設定的 ',
    addrKeyTail: '。兩者是同一把 key 的公開/秘密兩面。',

    includeKeyBefore: '把我剛產生的 agent 私鑰填進 ',
    includeKeyAfter: '（含真鑰，請只在自己機器使用）',

    placeholderAfter:
      ' 為佔位 — 貼上你保存的 agent 私鑰即可（在本頁用「產生 agent 金鑰」產生的，可勾選自動填入）。',

    finalWarnBefore: 'agent 私鑰只放你本機的 agent 設定，',
    finalWarnBold1: '勿外流',
    finalWarnMid1: '。私鑰只存在你瀏覽器記憶體（不寫伺服器、不入庫）； 預設匯出的 ',
    finalWarnMid2: ' 為佔位字串，只有你',
    finalWarnBold2: '明確勾選「填入私鑰」',
    finalWarnAfter: '時才會含真鑰——此時請勿把這份 JSON 貼到任何他人/公開處。',
  },
};
