import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/sessions.ts`。
 */
export const sessions: Catalog['sessions'] = {
  title: '🤖 AI Agent Sessions',
  viewOn: 'View on {explorer} ↗',

  ssi: {
    title: 'The SSI triangle: your wallet is the root of trust',
    flow: 'Flow: connect wallet → set limits and create a session → issue an authorization VC → export the agent config in one click → from then on, just state trade intent verbally.',
  },

  wrongNetwork: {
    title: 'Switch to Base Sepolia (chainId 84532)',
    unknownChain: 'Unknown network',
  },

  create: {
    title: 'Create Session',
    agentAddress: 'Agent address (session key)',
    agentPlaceholder: '0x… or click Generate agent key on the right',
    generateKey: 'Generate agent key',
    maxPerTrade: 'Max / trade (USDC)',
    totalBudget: 'Total budget (USDC)',
    maxLeverage: 'Max leverage',
    validFor: 'Valid for (hours)',
    creating: 'Creating…',
    cta: 'Create Session',
    done: 'Session created ✓',
  },

  /** 瀏覽器裡產生的一次性 burner 金鑰。 */
  key: {
    title: '🔑 Your agent-only key (burner)',
    clear: 'Clear',
    addressChip: 'Address (authorized on-chain)',
    privateKeyChip: 'Private key (kept local only)',
    /** 私鑰被遮住時，圓點後面接的那一段字。 */
    hiddenSuffix: ' (hidden)',
    reveal: 'Reveal',
    hide: 'Hide',
    copy: 'Copy',
    copyAddressLabel: 'Agent address',
    copyPrivateKeyLabel: 'Agent private key',
    generated: 'Agent-only key generated (this browser only — save it now)',
  },

  list: {
    title: 'My Sessions',
    refresh: '↺ Refresh',
    loading: 'Loading…',
    empty: 'No sessions yet. Create one to authorize an agent.',

    column: {
      id: '#',
      agent: 'Agent',
      spent: 'Spent / Budget',
      maxPerTrade: 'Max/trade',
      leverage: 'Lev',
      expiry: 'Expiry',
      status: 'Status',
      credential: 'Credential',
    },

    status: {
      revoked: 'Revoked',
      expired: 'Expired',
      active: 'Active',
    },

    issued: 'Issued ✓',
    export: 'Export ⤓',
    issueVc: 'Issue VC',
    signing: 'Signing…',
    issueVcHint: 'Sign the authorization VC with MetaMask',
    issueVcNeedsWallet: 'Requires a real wallet to sign (not supported in mock mode)',
    revoke: 'Revoke',
    revoked: 'Session revoked ✓',
    credentialIssued: 'Credential issued ✓',
    needsRealWallet: "Connect a real wallet to sign the VC (mock mode doesn't support signing)",
  },

  /** Base Account + Base Spend Permission setup (one EIP-5792 batch). */
  baseAccount: {
    title: 'Fund the agent from a Base Account',
    intro:
      'With a Base Account (Coinbase Smart Wallet), one batch approves a Base Spend Permission to our funder, names the agent above as top-up agent, and opens a session with the caps above (assets sBTC and sETH). The Spend Permission caps how much margin can leave the wallet each day; the session caps what the agent does with it.',
    dailyAllowance: 'Daily allowance (mUSDC)',
    cta: 'Set up with one Base Account batch',
    sending: 'Waiting for your wallet…',
    checking: 'Checking the connected account…',
    smart: 'Coinbase Smart Wallet detected.',
    smartAddOwner: 'Coinbase Smart Wallet detected. The batch also adds SpendPermissionManager as an owner, which Spend Permissions need.',
    undeployed: 'This wallet can batch calls; the Base Account will be created by this batch.',
    notSmart: 'This is a regular wallet (EOA). Spend Permissions need a Base Account (Coinbase Smart Wallet).',
    notCoinbase: 'This account is a contract but not a Coinbase Smart Wallet, so Spend Permissions cannot move its funds.',
    readFailed: 'Could not read this account from Base Sepolia.',
    retry: 'Retry',
    rejected: 'You declined the request in your wallet. Nothing was sent.',
    badHours: 'Set "Valid for (hours)" above to more than one minute first (for example 1).',
    wrongChain: 'Switch to Base Sepolia: the funder is deployed there.',
    needAgent: 'Enter the agent address above first.',
    unsupported: 'Your wallet does not support wallet_sendCalls (EIP-5792). Use a Base Account or Coinbase Wallet.',
    done: 'Done: Spend Permission approved and session opened. Sign its credential in the list below, then give the agent the credential and this Spend Permission.',
    failed: 'The batch failed: {reason}',
    timeout: 'Submitted, but not confirmed after 90 seconds. Check your wallet; the session list refreshes when it lands.',
    noSpmOwner:
      'Your Base Account was created without SpendPermissionManager as an owner, so the agent cannot use the Spend Permission yet. Add it with one call from your account; this opens no new session.',
    addOwnerCta: 'Add SpendPermissionManager as owner',
    ownerPending:
      'One step left: SpendPermissionManager must become an owner of this account before the agent can use the Spend Permission (see below).',
    spmOwnerUnknown:
      "Could not confirm yet whether the new Base Account lists SpendPermissionManager as an owner. The agent's top-ups only work if it does.",
    checkAgain: 'Check again',
    reading: 'Reading the account…',
    fixDone: 'SpendPermissionManager is now an owner of this account. The agent can use the Spend Permission below.',
    fixTimeout:
      'Submitted, but not confirmed after 90 seconds. Check your wallet, then press the button again: it reads the account first and sends nothing if SpendPermissionManager is already an owner.',
    permissionLabel: 'Spend Permission for the agent (top_up_margin)',
    copy: 'Copy',
    balance: 'mUSDC in this account: {amount}. The agent can only top up margin the account actually holds.',
    recordedRun: 'Recorded run on Base Sepolia',
  },

  /** 匯出對話框。 */
  export: {
    title: '🔌 Connect your Agent — Session #{id}',
    close: 'Close',
    closeAria: 'close',
    intro:
      'Paste both of the following into your local agent client. From then on, just state a "trade intent" verbally — the agent will place orders on your behalf within the session limits, using the VC:',

    mcpTitle: 'MCP config (Claude Desktop / Code)',
    vcTitle: 'Authorization VC (for order verification)',
    copy: 'Copy',
    download: 'Download .json',
    copyMcpLabel: 'MCP config',
    copyVcLabel: 'Authorization VC',

    /** 匯出的 MCP 設定裡，私鑰欄位的預設佔位提示。 */
    privateKeyPlaceholder:
      '0x...   # Paste the agent private key you just generated/saved (keep it local, do not share)',
  },

  copied: '{label} copied ✓',
  copyFailed: 'Copy failed (browser clipboard permission)',

  sessionManager: 'AgentSessionManager: {address}',

  /** 交易正在跑的時候按鈕上的字。 */
  working: '…',

  /** #36：十段句中夾標記的說明，各自拆成標記前後的片段。 */
  markup: {
    introBefore:
      "Delegate a bounded session key to the agent: capped per-trade margin, total budget, max leverage, and an expiry. The agent can only open/close positions on your behalf through AgentSessionManager within those limits, and never holds your main wallet's private key. Each agent has a ",
    introMid: ' identity, and the authorization can be credentialed as a ',
    introAfter:
      ' for signature verification before an order (SSI / verifiable autonomous trading, see docs/AGENT_IDENTITY_VC_SSI.md).',

    roleIssuerBefore: '🖊️ ',
    roleIssuerBold: 'Issuer=you',
    roleIssuerAfter: ': sign the authorization VC with MetaMask (the private key never leaves the wallet)',
    roleHolderBefore: '🤖 ',
    roleHolderBold: 'Holder=agent',
    roleHolderAfter: ': holds the VC + session key to place orders on your behalf',
    roleVerifierBefore: '✅ ',
    roleVerifierBold: 'Verifier=MCP/contract',
    roleVerifierAfter: ': verifies the signature before the order + cross-checks the on-chain session',

    wrongNetBefore: 'AI Agent Sessions is deployed on ',
    wrongNetMid: ' testnet. You are currently connected to',
    wrongNetAfter: ' — please switch to Base Sepolia in MetaMask and reload this page.',

    keyNoteBold1: 'The agent uses a separate session key, not your main wallet',
    keyNoteMid1: ': ',
    keyNoteBold2: 'Address',
    keyNoteMid2: ' → used to authorize the session below; ',
    keyNoteBold3: 'Private key',
    keyNoteAfter:
      " → goes into the agent's MCP config, plus a little ETH for gas. If you don't have one yet, click \"Generate agent key\" to create a new burner in the browser.",

    burnerWarnBefore:
      'This is a separate burner key, bound only by the session limits you set below. Save it to your local agent config — ',
    burnerWarnBold: "don't fund it like your main wallet",
    burnerWarnAfter: '. This page shows it only once, and it is never uploaded or written to a server.',

    step1Before: 'Paste the ',
    step1Bold: 'MCP config',
    step1Mid1: " into Claude Desktop/Code's ",
    step1Mid2: ', and replace ',
    step1After: " with your local agent's session key.",
    step2Before: 'Save the ',
    step2Bold: 'authorization VC',
    step2Mid1: ' as a file; when the agent places an order, point ',
    step2Mid2: ' at it (or the MCP ',
    step2Mid3: "'s ",
    step2After: ').',
    step3:
      'Once that\'s done, just tell the agent: "Open a 3x long on sBTC with 200 margin" — no need to give an account or address.',

    addrKeyBold1: 'Address',
    addrKeyMid1: ' (',
    addrKeyMid2: ') = the agent authorized on-chain, held in the session / VC; ',
    addrKeyBold2: 'Private key',
    addrKeyAfter: ' = the value for this address, kept only in your local agent config as ',
    addrKeyTail: '. The two are the public and secret sides of the same key.',

    includeKeyBefore: 'Fill the agent private key I just generated into ',
    includeKeyAfter: ' (contains the real key — use only on your own machine)',

    placeholderAfter:
      ' is a placeholder — paste in the agent private key you saved (the one generated on this page with "Generate agent key"; you can check the box to auto-fill it).',

    finalWarnBefore: 'The agent private key stays only in your local agent config — ',
    finalWarnBold1: 'do not leak it',
    finalWarnMid1:
      ". The private key exists only in your browser's memory (never written to a server or database); the default exported ",
    finalWarnMid2: ' is a placeholder string — only when you ',
    finalWarnBold2: 'explicitly check "Fill in private key"',
    finalWarnAfter:
      ' will it contain the real key — in that case, do not paste this JSON anywhere public or share it with anyone.',
  },
};
