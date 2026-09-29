/**
 * 營運端的三個頁面：Oracle 管理、Treasury 管理、Agent 監控。
 *
 * 這一批和其他批不同的地方：**句中夾標記的句子沒有留到 #36，就地處理完**。
 * 因為 #35 要求這三頁進 ratchet 白名單，而白名單的條件是「註解以外沒有中文」——
 * 留一句在原地，整批就進不了白名單。
 *
 * 處理方式：整句進 catalog，句內的 `<b>` / `<code>` 強調拿掉。這些標記全部是
 * 行內、沒有 margin，所以**畫面上的文字逐字不變**，變的只有粗體與等寬樣式。
 * 唯一的例外是 `comparison.engineNoteBefore` / `engineNoteAfter`：那裡的
 * `<code>` 帶了 `mx: 0.5`，字面上沒有空白、視覺上有間距，攤平成一個字串就得
 * 憑空加兩個空格。那一句因此拆成夾住 code 的前後兩段，畫面完全不動。
 *
 * 時間戳記：兩個原本寫死 `'zh-TW'` 的 `toLocaleString` 改吃 `locale`，否則英文
 * build 會在英文介面裡印出中文日期。
 */
export const admin = {
  oracle: {
    connectWallet: '連接錢包以使用 Oracle 管理。',
    title: 'Oracle 價格管理',
    subtitle: '僅 oracle owner 錢包可更新價格。',
    viewOn: '在 {explorer} 查看 ↗',

    ownerReadFailed: '讀取 oracle owner 失敗：',
    /** 讀 owner 失敗但錯誤物件不是 Error 時的後備說明。 */
    ownerReadFallback: '讀取 owner 失敗',
    checkingOwner: '檢查 owner 權限中…',
    readOnly: '唯讀模式：目前連接的錢包不是 oracle owner，更新將會失敗（revert）。',
    ownerLabel: 'Owner：',
    youLabel: '你：',
    ownerVerified: 'Owner 驗證成功 ✓',

    noteLabel: '備註：',
    noteBody:
      'MockOracle 的價格變動會立即影響所有未平倉部位的 PnL。正式環境中，oracle 價格會來自可信賴的鏈下資料來源（例如 Chainlink）。',

    notOwner: '目前連接的錢包不是 oracle owner',
    priceUpdated: '價格已更新 ✓',
    fundingSettled: '資金費已結算 ✓',

    funding: {
      title: '資金費結算',
      description: '逐標的結算資金費（每 {interval}）。任何人皆可在鏈上呼叫；UI 限制僅 owner 可操作。',
      autoSettle: '自動結算',

      column: {
        asset: '標的',
        rate: '費率（bps）',
        longOi: '多方未平倉',
        shortOi: '空方未平倉',
        imbalance: '失衡程度',
        lastSettled: '上次結算',
        nextIn: '下次倒數',
      },

      longsPay: '（多方支付）',
      shortsPay: '（空方支付）',
      never: '從未',
      ready: '可結算',
      settleNow: '立即結算',

      /** 下次可結算的倒數。三種區間各自是完整的一句話。 */
      countdownNow: '現在',
      countdownMinutes: '~{n} 分鐘',
      countdownSeconds: '~{n} 秒',
    },

    comparison: {
      title: 'Oracle 來源比較',
      refresh: '↺ 重新整理',

      /**
       * 夾住 `<code>immutable</code>` 的前後兩段。那個 code 元素帶 `mx: 0.5`，
       * 間距來自 CSS 而不是空白字元——攤平成單一字串就得無中生有兩個空格。
       */
      engineNoteBefore:
        '交易引擎目前使用 MockOracle（由 keeper 從真實市場抓價寫入）。 Chainlink / Pyth adapter 已部署並可即時查詢（如下表）， 但尚未接入交易引擎 —— PerpetualExchange 的 oracle 位址是',
      engineNoteAfter: '且無 setter，切換來源需重新部署，故整合列為下一階段。',

      wrongNetwork:
        'Chainlink / Pyth adapter 僅部署於 Base Sepolia（chainId 84532）。 請切換網路以查看三來源即時比較；本網路僅顯示 MockOracle 價格。',

      column: {
        asset: '資產',
        mock: 'MockOracle（引擎使用）',
        chainlink: 'Chainlink',
        pyth: 'Pyth',
      },

      dashNote:
        '「—」表示該 adapter 這一刻拿不到可信報價，有兩種原因：(1) 未提供此資產的 feed （多為股票／ETF，Chainlink 與 Pyth 測試網僅涵蓋主流加密資產）；(2) 報價已過期或不完整—— adapter 現在採 fail-closed，staleThreshold（預設 1 小時）內沒更新、round 不完整、 或 Pyth 信賴區間過寬時會直接 revert，不會再回傳舊價。所以同一列從有數字變成「—」 代表該來源劣化了，不是 feed 被移除。',
    },

    prices: {
      title: '資產價格（8 位小數）',
      refresh: '↺ 重新整理',
      lastUpdated: '上次更新：{when}',
      updating: '更新中…',
      update: '更新價格',
    },

    raw: {
      title: '原始 8 位小數價格（供 cast 指令使用）',
    },
  },

  treasury: {
    connectWallet: '連接錢包以使用 Treasury 管理。',
    viewOnEtherscan: '在 Etherscan 查看 ↗',

    /** 權限閘門。「還在讀鏈上 treasury」和「確定不是你」要說不同的話。 */
    checkingAuth: '確認權限中…',
    checkingAuthBody: '正在讀取鏈上的 feeRouter.platformTreasury()。讀不到就不放行。',
    notAuthorized: '無權限',
    notAuthorizedBody: '此頁面僅限設定為 feeRouter.platformTreasury() 的錢包存取。',
    treasuryFallbackLabel: 'Treasury（後備顯示值）：',
    treasuryOnChainLabel: 'Treasury（鏈上）：',

    title: 'Treasury 管理',
    subtitle: '將累積的平台手續費兌現 → ETH',

    stat: {
      pendingFees: '待領取平台手續費',
      walletMusdc: '錢包 USDC 餘額',
      walletEth: '錢包 ETH 餘額',
      routerEth: 'Router ETH 儲備',
    },

    claim: {
      title: '從 FeeRouter 領取平台手續費',
      treasury: 'Treasury：{address}',
      pending: '待領取平台手續費',
      claiming: '領取中…',
      cta: '領取平台手續費',
      note: '此操作會將所有累積的平台分潤（每筆跟單／績效手續費的 20%）轉入你的錢包。',
      done: '平台手續費已領取 ✓',
    },

    swap: {
      title: '透過 SwapRouter 將 USDC 轉換為 ETH',
      placeholder: 'USDC 金額',
      max: '最大值',
      estimate: '≈ {eth} ETH（匯率：1 ETH = 3000 USDC）',
      routerInsufficient:
        'Router 目前僅有 {amount} ETH 可用。請先使用下方的 Treasury 工具挹注資金，再進行兌換。',
      approving: '批准中…',
      approve: '① 批准 USDC',
      approved: 'USDT 已批准 ✓',
      swapping: '兌換中…',
      swap: '② 兌換為 ETH',
      done: '已將 {amount} USDC 兌換為 {eth} ETH ✓',
    },

    tools: {
      title: 'Treasury 工具',
      fundRouter: '為 SwapRouter 挹注 ETH',
      fundRouterDesc: 'Router 需要 ETH 儲備才能處理使用者與管理員的 USDC→ETH 兌換。',
      currentReserve: '目前儲備：',
      placeholder: 'ETH 數量（例如 1）',
      funding: '挹注中…',
      cta: '挹注 Router',
      done: '已為 Router 挹注 {amount} ETH ✓',
    },

    incentives: {
      title: '🎁 獎勵池充值',
      description:
        '跟單獎勵、每日簽到、等級晉級與交易挖礦均由 PEPE 代幣激勵。為防止用戶領取時發生 revert InsufficientPool 錯誤，請確保此激勵合約中有足夠的 PEPE 儲備。',
      walletBalance: '我的錢包 PEPE 餘額',
      poolBalance: '激勵合約 PEPE 儲備',
      placeholder: '注資 PEPE 數量 (例如 100000)',
      funding: '注資中…',
      cta: '確認注資',
      done: '已成功為激勵合約注資 {amount} PEPE ✓',
    },

    history: {
      title: '近期兌現紀錄',
      refresh: '↺ 重新整理',
      emptyTitle: '尚無兌現紀錄',
      emptyDescription: '手續費領取與 USDC→ETH 兌換紀錄將顯示於此。',
      claimed: '已領取',
      swapped: '已兌換',
      claimAmount: '{amount} USDC',
      swapAmount: '{usdcIn} USDC → {eth} ETH',
    },

    info: {
      revenueModelLabel: '收益模式：',
      revenueModelBody:
        '每筆跟單或績效手續費依 70% 交易者 / 20% 平台 / 10% 保險金庫 分配。平台手續費會累積在 FeeRouter，直到此管理員領取為止。',
      swapNote:
        '領取 USDC 後，可使用上方的兌換功能以模擬匯率（1 ETH = 3000 USDC）轉換為 ETH。正式環境中則會使用真正的 DEX。',
    },
  },

  kyc: {
    connectWallet: '連接錢包以使用審核頁。',

    /** 權限閘門。跟 treasury 同一套姿態：還在讀鏈上、和確定不是你，要說不同的話。 */
    checkingAuth: '確認權限中…',
    checkingAuthBody: '正在讀取鏈上的 owner() 與 verifiers()。讀不到就不放行。',
    notAuthorized: '無權限',
    notAuthorizedBody: '此頁面僅限 KYCRegistry 的 owner 或已指派的審核員存取。',

    /** 進得去之後，講清楚是以哪個身分——owner 和 verifier 權限相同，但意義不同。 */
    roleOwner: '你是以 owner 身分進入',
    roleVerifier: '你是以已指派審核員身分進入',

    /** 只有 owner 看得到——見 KYCRegistry.sol 的 setVerifier，讓 owner 能冷藏、
     *  審核交給熱錢包，見 docs/ROLE_SEPARATION.md。 */
    verifierAdmin: {
      title: '指派審核員',
      body: '被指派的地址能以審核員身分核准／撤銷 KYC，owner 不必上線。',
      addressLabel: '審核員地址',
      addressPlaceholder: '0x…',
      invalidAddress: '請輸入合法的地址',
      assign: '指派',
      assigning: '指派中…',
      assigned: '已指派審核員 ✓',
      revoke: '撤銷指派',
      revoking: '撤銷中…',
      revoked: '已撤銷審核員 ✓',
    },

    title: 'KYC 審核',
    subtitle: '審核待審申請、查看驗證狀態、撤銷驗證。',

    /** 硬擋不是保密，是「不主動幫人彙整」——資料本來就在公開鏈上，誰都能自己掃 log。 */
    notSecrecyNotice:
      '這個頁面把申請人資料擋在權限之後，是為了不主動幫人彙整成一份清單，不是因為資料是保密的——KYCRegistry 是公開合約，任何人都能自己掃鏈上事件看到同樣的內容。',

    queue: {
      readErrorSome: '{count} 筆申請的狀態讀取失敗，未列入清單，可重新整理再試。',
      readErrorAll: '讀取審核佇列失敗，可能是 RPC 節點限流，請重新整理再試。',
      /** 掃描 KYCSubmitted 掉段，比某幾筆讀不到更嚴重——佇列本身可能漏了申請人。 */
      scanIncomplete: '掃描鏈上事件時有 {count} 段失敗，佇列可能不完整（部分申請人未列出），可重新整理再試。',
      refresh: '↺ 重新整理',
      scanRange: '掃描範圍：區塊 {from} – {to}',
      scanning: '掃描鏈上事件中…（{done}/{total}）',

      pendingTitle: '待審申請',
      pendingEmpty: '目前沒有待審申請。',

      /** 見 ADR 0005：batchVerify 造出的帳號從沒呼叫過 submitKYC，這份清單看不到它們。 */
      verifiedTitle: '已驗證（經審核流程通過）',
      verifiedCaveat: '只列出經審核流程（送出 → 核准）通過的地址。透過 batchVerify 直接寫入的種子帳號不會出現在這裡，即使 isVerified() 對它們也是 true。',
      verifiedEmpty: '目前沒有經審核流程通過的地址。',

      revokedTitle: '已撤銷',
      revokedEmpty: '目前沒有被撤銷的地址。',
      revokedNote: '撤銷只擋新開的受管制倉位，既有倉位仍可正常平倉。',

      column: {
        address: '地址',
        name: '姓名',
        nationality: '國籍',
        submitted: '送出於',
        screening: '建議',
        action: '',
      },

      approve: '核准',
      approving: '核准中…',
      approved: '已核准 ✓',
      approveAllClean: '一次核准所有乾淨申請（{count}）',
      approveAllCleanBusy: '批次核准中…',
      approveAllCleanDone: '已批次核准 {count} 筆 ✓',
      /** approveKYCBatch 沒有逐筆 try/catch，一筆失敗整批一起倒——要講清楚退路。 */
      approveAllCleanFailedHint: '批次核准沒有逐筆容錯，一筆失敗會讓整批都沒核准到。請改用清單裡每一筆自己的「核准」鍵逐一處理。',

      revoke: '撤銷',
      revoking: '撤銷中…',
      revoked: '已撤銷 ✓',

      /** 見 ADR 0004：這一組只產出建議，approveKYC 永遠是人按下去的。 */
      screening: {
        disclaimer: '以下建議由虛構的示範規則產生（見 kycScreening.ts），不對應任何真實制裁名單或真實轄區風險，僅供展示審核流程使用。',
        clean: '乾淨',
        needsReview: '需人工複核',
        reasonUnclearJurisdiction: '轄區未列於平台清單',
        reasonWatchlistNameMatch: '姓名命中虛構 watchlist',
      },
    },
  },

  agent: {
    connectWallet: '連接錢包以查看 agent 監控。',
    title: '📊 Agent 風險監控',
    live: '即時',
    subtitle: '監控 AI agent 經濟：委派 session 的限額使用、x402 收入分潤、預言機健康度。唯讀。',

    disclosure:
      '償付後盾揭露：ADL（自動減倉）與組合保證金已實作、由旗標控管，本測試網部署 目前預設關閉（線上跑逐倉清算 + 保險金庫 bailout）。極端行情下，在 ADL 啟用前協議 作為對手方仍有償付風險——本頁數據不代表線上償付無虞。詳見 docs/RISK_NOTES.md。',

    kpi: {
      chain: '鏈',
      activeSessions: '進行中 session',
      staleFeeds: '過期報價',
      vaultAssets: '金庫資產（USDC）',
      vaultPrice: '金庫價格（USDC/pIV）',
      x402Fees: 'x402 手續費（USD）',
    },

    sessions: {
      title: '已委任 Session',
      refresh: '↺ 重新整理',
      wrongNetwork:
        '請切換到 Base Sepolia（chainId 84532）以檢視 agent sessions。目前網路：{chain}。',
      notConnected: '未連線',
      empty: '尚無 session。',

      column: {
        id: '#',
        user: '使用者',
        agent: 'Agent',
        budgetUse: '預算使用率',
        maxLeverage: '最大槓桿',
        expiry: '到期',
        status: '狀態',
      },

      status: {
        revoked: '已撤銷',
        expired: '已過期',
        highUse: '高使用率',
        expiring: '即將到期',
        active: '進行中',
      },
    },

    verification: {
      title: 'Agent 驗證（ERC-8126）',
      description:
        '「這個 agent 可不可信？」— ETV / SCV / WAV / WV 四項檢查 + 統一 0–100 風險分數（越低越安全），verifier 簽章。',
      inputLabel: 'agent 地址或 did:pkh',
      inputPlaceholder: '0x… 或 did:pkh:eip155:84532:0x…',
      enterQuery: '請輸入 agent 地址或 did:pkh',
      verifying: '驗證中…',
      verify: '驗證',
      failed:
        '無法取得驗證（{error}）。請確認 signal-api URL，並見 docs/AGENT_ECONOMY_STANDARDS.md。',
      fetchFailed: '讀取失敗',

      riskChip: '風險 {score}/100 · {tier}',
      checkChip: '{type} {score}',
      checkNotApplicable: '不適用',
      checkTooltip: '{name}: {details}',
      identity: 'subject: {subject} · verifier: {verifier}',
    },

    revenue: {
      title: 'x402 收益（70/20/10）',
      urlLabel: 'signal-api URL',
      fetch: '讀取',
      failed: '無法連到 signal-api（{error}）。請先 npm run signal-api。',
      callsTotal: '呼叫次數 / 總計',
      traderShare: '交易者 70%',
      platformShare: '平台 20%',
      vaultShare: '金庫 10%',
      topBeneficiaries: '主要受益者（70% 分潤）',
      loading: '載入中…',
    },

    oracle: {
      title: 'Oracle 健康度',
      column: {
        asset: '標的',
        price: '價格',
        funding: '資金費率',
        feed: '報價來源',
      },
      stale: '過期',
      fresh: '新鮮',
    },

    sessionManager: 'AgentSessionManager: {address}',
  },
};
