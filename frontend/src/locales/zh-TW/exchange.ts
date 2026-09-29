/**
 * Exchange 頁。
 *
 * 這一頁是全站最大的下單路徑，也是搬移最麻煩的一頁：條件字串、插值、句中夾標記
 * 三種都有。前兩種都搬進來了；**句中夾標記**那一種刻意留在原地，交給 #36 一起處理。
 *
 * 兩個在這一頁反覆出現的寫法，值得先說清楚：
 *
 * 1. **條件字串拆成兩個 key**，不是一個 key 加膠水。`busy ? '領取中…' : '領取 X'`
 *    寫成 `claiming` 與 `claimToken` 兩條完整的句子，而不是 `'領取' + suffix`——
 *    詞序是語言的一部分，拼接會把它焊死在中文的順序上。
 *
 * 2. **跨行的句子帶著那個空白**。JSX 會把字串中間的換行壓成一個半形空格，所以
 *    畫面上本來就有那個空格。搬移階段要求逐字相同，就得連它一起搬——不是筆誤。
 */
export const exchange = {
  connectWallet: '連接錢包以使用交易所。',
  loadingChainData: '載入區塊鏈資料中…',

  /** 全域交易覆蓋層上，標題底下那句固定的說明。 */
  confirmInWallet: '請在錢包中確認交易，並等待區塊確認。',

  /** 送出交易前後對使用者說的話。 */
  tx: {
    enterValidAmount: '請輸入有效金額',
    insufficientBalance: '{token} 餘額不足，你只有 {balance} {token}。',

    /**
     * 兌換池的 oracle 過期。這句話在按下去之前就要說——合約會 revert
     * StaleOraclePrice，等使用者付完 gas 才知道是最糟的順序。
     */
    ammStale:
      '兌換池的參考預言機報價已過期，合約會拒絕兌換（StaleOraclePrice）。請等 keeper 更新價格後再試。',

    approving: '批准 {token} 中…',
    swappedEthForToken: '已用 {amount} ETH 兌換約 {received} {token} ✓',
    swappedTokenForEth: '已用 {amount} {token} 兌換約 {received} ETH ✓',

    faucetStable: '已領取測試 {token} ✓ — 可在右側 Margin Account「Approve & Deposit」作為保證金',
    faucetAltStable: '已領取測試 {alt} ✓ — 可持有與兌換；保證金請用 {token}',
    faucetPepe: '已領取測試 PEPE ✓',


  },

  /** 全域交易覆蓋層上的字，依當下進行中的動作切換。 */
  loading: {
    fallback: '處理交易中…',
    swapEthToToken: '兌換 ETH 為 {token} 中…',
    swapTokenToEth: '兌換 {token} 為 ETH 中…',
    faucetStable: '領取測試 {token} 中…',
    faucetPepe: '領取測試 PEPE 中…',
  },

  /**
   * 新手引導卡。只有標題進 catalog：底下那四條 `<li>` 每一條都是
   * `<strong>前綴：</strong> 說明` 的句中夾標記，和幣別說明那段一起留給 #36。
   */
  guide: {
    title: 'Mandate Layer 上的 CFD 交易如何運作',
    /** SHOW_PERPETUALS 關閉時的版本——那時這一頁沒有開倉面板,教 CFD 只會讓人去找一個不存在的東西。 */
    spotTitle: '在 Mandate Layer 上買賣代幣化資產',
  },

  /** 水龍頭區塊。三種代幣共用同一組「領取中／領取 X／尚未部署」的字。 */
  faucet: {
    title: '🚰 取得測試代幣',
    intro:
      'PEPE 是平台幣（測試網模擬），用水龍頭免費領取；{stable} 為模擬保證金穩定幣；x402 付費用 {x402Stable}。',

    stableNote: '· 模擬保證金',
    altStableNote: '· 模擬穩定幣（持有／兌換）',
    pepeNote: '· 平台幣',

    balance: '餘額：{amount}',
    notDeployed: '尚未在本網路部署',
    notDeployedChip: '尚未部署',

    claiming: '領取中…',
    claimToken: '領取 {token}',

    pepeUndeployed:
      'PEPE 尚未在本網路（Base Sepolia）部署。部署 PepeToken 後把位址填入 addresses.ts 即可開放領取。',

    addToWallet: '把 {token} 加入 MetaMask',
  },

  /** ETH ↔ USDC 兌換區塊（PepeAMM）。 */
  swap: {
    title: '兌換',
    poolBadge: '● 恆定乘積池 · 有滑點',
    notDeployed: '本網路未部署兌換池（PepeAMM）。請切換到 Base Sepolia。',

    youPay: '你支付',
    youReceive: '你將收到（預估）',
    balance: '餘額：{amount}',

    /**
     * 池內現價和 oracle 參考價是兩個不同的數字，所以是兩條 label 而不是一條——
     * 它們分岔超過 maxOracleDeviationBps 時合約就會擋下兌換。
     */
    poolPrice: '池內現價',
    oracleRef: 'Oracle 參考價',
    poolReserves: '池內儲備量',
    priceImpact: '價格衝擊（含手續費）',
    minimumReceived: '最低收到數量（{tolerance}% 容忍）',

    constantProductNote:
      '恆定乘積 (x·y=k) 池：金額越大滑點越高。報價已含 0.3% 手續費，minOut 以即時 quote 為基準。',

    swapping: '兌換中…',
    oracleStale: '⛔ 預言機報價過期，暫停兌換',
    enterAmount: '請輸入金額',
    ethToToken: '兌換 ETH → {token}',
    tokenToEth: '兌換 {token} → ETH',
  },

  esgLeaderboard: {
    title: 'ESG 排行榜',
  },

  /** 按鈕正在跑交易的時候，格子裡顯示的字。 */
  working: '…',

  /**
   * #36：句中夾標記的句子。拆分只在**真的有標記**的邊界上發生：標記前一段、標記
   * 內一段（如果是真的文字而不是像 {STABLE_LABEL} 這種不譯的資料值——那種就把
   * `<b>{value}</b>` 整段留在 JSX 裡，不拆出獨立 key）、標記後一段。
   *
   * 原本沒有標記、只是被原始碼折成兩行的**同一段純文字**，一律合併成一個 key、
   * 中間手動放一個半形空格——不能拆成兩個 key 各佔一行再指望 JSX 幫忙補空格。
   * JSX 只會把「同一個文字節點裡」跨行的空白折成一個空格；兩個 `{expr}` 之間
   * 單純換行、中間沒有別的字元，那段空白會被直接砍掉，不會變成空格。第一版曾經
   * 這樣拆過幾句，實測畫面上少了空格，才改成現在這個規則。
   */
  markup: {
    syntheticPositionBefore: '本頁開倉為',
    syntheticPositionBold: '合成持倉',
    syntheticPositionAfter:
      '（記錄在 PerpetualExchange，錢包內不會出現代幣）。 想要真正持有 ERC-20 代幣？',
    tokenizedAssetsLink: '前往代幣化資產頁 →',

    stepBuyLabel: '買入資產：',
    stepBuyBody: '到「資產交易」頁,用 {token} 買進代幣化的股、債、金、幣——代幣會直接進到你的錢包。',
    stepPortfolioLabel: '看配置：',
    stepPortfolioBody: '回「投資組合」頁,四大類的佔比、市值與損益都在那裡。',

    stepGetTokensLabel: '取得代幣：',
    stepGetTokensBody: '從水龍頭領取測試用 {token}（以及 PEPE）——不需要兌換。',
    stepMarginLabel: '保證金帳戶：',
    stepMarginBody: '批准並將 {token} 存入 PerpetualExchange，這將成為你的可用保證金。',
    stepOpenLabel: '開倉：',
    stepOpenBody:
      '使用可用保證金在 11 種合成資產上做多/做空——加密貨幣（sBTC、sETH）、股票（sAAPL、sTSLA、sNVDA、sMSFT、sGOOGL）、商品（sGOLD）、債券（sBOND），以及 ESG ETF（sICLN、sESGU）。🔒 = 需要 KYC。',
    stepPnlLabel: 'PnL：',
    stepPnlBody: '價格變動 → 部位價值改變 → 平倉即可實現 PnL。',

    currencyNoteLine1Before: '💱 幣別：平台保證金與兌換用 ',
    currencyNoteLine1After: '（測試網模擬幣，可用 Faucet 免費領）；',
    currencyNoteLine2After: ' 付費 API 結算用 ',
    currencyNoteLine2End: '（EIP-3009，真實資產）。兩者用途不同、勿混用。',

    ethBalanceBefore: 'ETH 餘額：',
    ethBalanceAfter: '（開倉需少量 ETH 付執行費）',
    /** SHOW_PERPETUALS 關閉時的版本:這一頁沒有開倉,ETH 只用來付 gas。 */
    ethBalanceAfterSpot: '（鏈上交易需少量 ETH 付 gas）',

    faucetEoaLine1: '🔑 水龍頭只開放',
    faucetEoaBold1: '一般錢包（EOA）',
    faucetEoaLine1After: '領取：合約防機器人濫領的條件是',
    faucetEoaCode1: ' msg.sender == tx.origin',
    faucetEoaLine2Mid: '，所以用 ',
    faucetEoaBold2: 'Safe / ERC-4337 智能合約錢包',
    faucetEoaLine3: '（或任何 batch / multicall 代呼叫）點下去會被合約以 ',
    faucetEoaCode2: 'FaucetCallerMustBeEOA',
    faucetEoaLine3After: ' 拒絕。 請改用一般 EOA 錢包領取後再轉過去。每個地址 24 小時可領一次。',

    priceImpactBefore: '⚠ 這筆兌換的價格衝擊高達 ',
    priceImpactAfter: '，等於用遠差於市價的價格成交。 建議分批換小額；金額太大時合約還會以 ',
    priceImpactCode: 'PriceOutOfBand',
    priceImpactLine2After: ' 直接拒絕（池價被推離 oracle 太遠）。',





  },
};
