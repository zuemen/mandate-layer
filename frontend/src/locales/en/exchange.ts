import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/exchange.ts`。
 */
export const exchange: Catalog['exchange'] = {
  connectWallet: 'Connect wallet to access the exchange.',
  loadingChainData: 'Loading blockchain data...',

  /** 全域交易覆蓋層上，標題底下那句固定的說明。 */
  confirmInWallet: 'Please confirm the transaction in your wallet and wait for block confirmation.',

  /** 送出交易前後對使用者說的話。 */
  tx: {
    enterValidAmount: 'Enter a valid amount',
    insufficientBalance: 'Not enough {token} — your balance is {balance} {token}.',

    /**
     * 兌換池的 oracle 過期。這句話在按下去之前就要說——合約會 revert
     * StaleOraclePrice，等使用者付完 gas 才知道是最糟的順序。
     */
    ammStale:
      "The swap pool's reference oracle price is stale — the contract will reject the swap (StaleOraclePrice). Wait for the keeper to update the price and try again.",

    approving: 'Approving {token}…',
    swappedEthForToken: 'Swapped {amount} ETH for ~{received} {token} ✓',
    swappedTokenForEth: 'Swapped {amount} {token} for ~{received} ETH ✓',

    faucetStable:
      'Claimed test {token} ✓ — deposit it as margin using Approve & Deposit in the Margin Account panel on the right',
    faucetAltStable: 'Claimed test {alt} ✓ — hold or swap it; use {token} for margin',
    faucetPepe: 'Claimed test PEPE ✓',


  },

  /** 全域交易覆蓋層上的字，依當下進行中的動作切換。 */
  loading: {
    fallback: 'Processing transaction...',
    swapEthToToken: 'Swapping ETH to {token}…',
    swapTokenToEth: 'Swapping {token} to ETH…',
    faucetStable: 'Claiming test {token}…',
    faucetPepe: 'Claiming test PEPE…',
  },

  /**
   * 新手引導卡。只有標題進 catalog：底下那四條 `<li>` 每一條都是
   * `<strong>前綴：</strong> 說明` 的句中夾標記，和幣別說明那段一起留給 #36。
   */
  guide: {
    title: 'How CFD trading works on Mandate Layer',
    spotTitle: 'How to buy and sell tokenized assets on Mandate Layer',
  },

  /** 水龍頭區塊。三種代幣共用同一組「領取中／領取 X／尚未部署」的字。 */
  faucet: {
    title: '🚰 Get Test Tokens',
    intro:
      'PEPE is the platform token (testnet mock) — claim it free from the faucet. {stable} is the mock margin stablecoin. x402 payments settle in {x402Stable}.',

    stableNote: '· Mock margin',
    altStableNote: '· Mock stablecoin (hold / swap)',
    pepeNote: '· Platform token',

    balance: 'Balance: {amount}',
    notDeployed: 'Not deployed on this network',
    notDeployedChip: 'Not deployed',

    claiming: 'Claiming…',
    claimToken: 'Claim {token}',

    pepeUndeployed:
      "PEPE isn't deployed on this network (Base Sepolia) yet. Once PepeToken is deployed, add its address to addresses.ts to enable claiming.",

    addToWallet: 'Add {token} to MetaMask',
  },

  /** ETH ↔ USDC 兌換區塊（PepeAMM）。 */
  swap: {
    title: 'Swap',
    poolBadge: '● Constant-product pool · Slippage applies',
    notDeployed: "The swap pool (PepeAMM) isn't deployed on this network. Switch to Base Sepolia.",

    youPay: 'You pay',
    youReceive: 'You receive (est.)',
    balance: 'Balance: {amount}',

    /**
     * 池內現價和 oracle 參考價是兩個不同的數字，所以是兩條 label 而不是一條——
     * 它們分岔超過 maxOracleDeviationBps 時合約就會擋下兌換。
     */
    poolPrice: 'Pool price',
    oracleRef: 'Oracle ref.',
    poolReserves: 'Pool reserves',
    priceImpact: 'Price impact (includes fee)',
    minimumReceived: 'Minimum received ({tolerance}% tolerance)',

    constantProductNote:
      'Constant-product (x·y=k) pool — the bigger the amount, the higher the slippage. The quote already includes a 0.3% fee; minOut is based on the live quote.',

    swapping: 'Swapping…',
    oracleStale: '⛔ Oracle price is stale — swaps paused',
    enterAmount: 'Enter an amount',
    ethToToken: 'Swap ETH → {token}',
    tokenToEth: 'Swap {token} → ETH',
  },

  esgLeaderboard: {
    title: 'ESG Leaderboard',
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
   *
   * 英文和中文的斷詞方式不一樣：中文詞與詞之間不需要空格，英文需要。所以這裡的
   * 英文譯文在標記前後手動加了空格（中文原文沒有），不是筆誤——沒有那個空格，
   * 組出來的句子會黏成一個字。
   */
  markup: {
    syntheticPositionBefore: 'Positions opened on this page are ',
    syntheticPositionBold: 'synthetic positions',
    syntheticPositionAfter:
      ' (recorded in PerpetualExchange — no token ever appears in your wallet). Want to actually hold ERC-20 tokens? ',
    tokenizedAssetsLink: 'Go to the Tokenized Assets page →',

    stepBuyLabel: 'Buy assets:',
    stepBuyBody: 'Go to Trade Assets and buy tokenized equities, bonds, gold, and crypto with {token} — the tokens land directly in your wallet.',
    stepPortfolioLabel: 'Check your allocation:',
    stepPortfolioBody: 'Go to Portfolio — the share, value, and PnL of all four classes are there.',

    stepGetTokensLabel: 'Get tokens:',
    stepGetTokensBody: 'Claim test {token} (and PEPE) from the faucet — no swap needed.',
    stepMarginLabel: 'Margin Account:',
    stepMarginBody:
      'Approve & deposit {token} into PerpetualExchange. This becomes your free margin.',
    stepOpenLabel: 'Open Position:',
    stepOpenBody:
      'Use free margin to open long/short on 11 synthetic assets — crypto (sBTC, sETH), equity (sAAPL, sTSLA, sNVDA, sMSFT, sGOOGL), commodity (sGOLD), bond (sBOND), and ESG ETFs (sICLN, sESGU). 🔒 = KYC required.',
    stepPnlLabel: 'PnL:',
    stepPnlBody: 'Price moves → position value changes → close to realise PnL.',

    currencyNoteLine1Before: '💱 Currency: platform margin and swaps use ',
    currencyNoteLine1After: ' (testnet mock — free from the Faucet); ',
    currencyNoteLine2After: ' payments settle in ',
    currencyNoteLine2End:
      " (EIP-3009, real asset). The two serve different purposes — don't mix them up.",

    ethBalanceBefore: 'ETH balance: ',
    ethBalanceAfter: ' (opening a position needs a small amount of ETH for the execution fee)',
    ethBalanceAfterSpot: ' (on-chain transactions need a little ETH for gas)',

    faucetEoaLine1: '🔑 The faucet only pays out to ',
    faucetEoaBold1: 'regular wallets (EOAs)',
    faucetEoaLine1After: " — the contract's anti-bot condition is",
    faucetEoaCode1: ' msg.sender == tx.origin',
    faucetEoaLine2Mid: ', so a ',
    faucetEoaBold2: 'Safe / ERC-4337 smart contract wallet',
    faucetEoaLine3: ' (or any batch / multicall proxy call) gets rejected by the contract with ',
    faucetEoaCode2: 'FaucetCallerMustBeEOA',
    faucetEoaLine3After:
      '. Use a regular EOA wallet to claim instead, then transfer the tokens over. Each address can claim once every 24 hours.',

    priceImpactBefore: '⚠ This swap has a price impact as high as ',
    priceImpactAfter:
      " — that's filling far off the market price. Consider splitting into smaller swaps; too large an amount and the contract will reject it outright with ",
    priceImpactCode: 'PriceOutOfBand',
    priceImpactLine2After: ' (the pool price would be pushed too far from the oracle).',





  },
};
