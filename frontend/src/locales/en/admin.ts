import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/admin.ts`。
 */
export const admin: Catalog['admin'] = {
  oracle: {
    connectWallet: 'Connect wallet to access Oracle Admin.',
    title: 'Oracle Price Admin',
    subtitle: 'Only the oracle owner wallet can update prices.',
    viewOn: 'View on {explorer} ↗',

    ownerReadFailed: 'Failed to read oracle owner:',
    /** 讀 owner 失敗但錯誤物件不是 Error 時的後備說明。 */
    ownerReadFallback: 'Failed to read owner',
    checkingOwner: 'Checking owner permissions…',
    readOnly: 'Read-only mode: connected wallet is not the oracle owner. Updates will revert.',
    ownerLabel: 'Owner:',
    youLabel: 'You:',
    ownerVerified: 'Owner verified ✓',

    noteLabel: 'Note:',
    noteBody:
      'MockOracle price changes immediately affect all open position PnL. In production, oracle prices would come from trusted off-chain data feeds (e.g. Chainlink).',

    notOwner: 'Connected wallet is not the oracle owner',
    priceUpdated: 'Price updated ✓',
    fundingSettled: 'Funding settled ✓',

    funding: {
      title: 'Funding Settlement',
      description:
        'Settle per-asset funding (every {interval}). Anyone can call on-chain; UI restricts to owner.',
      autoSettle: 'Auto-Settle',

      column: {
        asset: 'Asset',
        rate: 'Rate (bps)',
        longOi: 'Long OI',
        shortOi: 'Short OI',
        imbalance: 'Imbalance',
        lastSettled: 'Last Settled',
        nextIn: 'Next In',
      },

      longsPay: '(L pay)',
      shortsPay: '(S pay)',
      never: 'Never',
      ready: 'Ready',
      settleNow: 'Settle Now',

      /** 下次可結算的倒數。三種區間各自是完整的一句話。 */
      countdownNow: 'Now',
      countdownMinutes: '~{n}m',
      countdownSeconds: '~{n}s',
    },

    comparison: {
      title: 'Oracle Source Comparison',
      refresh: '↺ Refresh',

      /**
       * 夾住 `<code>immutable</code>` 的前後兩段。那個 code 元素帶 `mx: 0.5`，
       * 間距來自 CSS 而不是空白字元——攤平成單一字串就得無中生有兩個空格。
       */
      engineNoteBefore:
        "The trading engine currently uses MockOracle (fed by the keeper from real market prices). Chainlink / Pyth adapters are deployed and queryable live (see the table below), but not yet wired into the trading engine — PerpetualExchange's oracle address is",
      engineNoteAfter:
        'and has no setter — switching sources requires a redeploy, so integration is planned for a later phase.',

      wrongNetwork:
        'Chainlink / Pyth adapters are only deployed on Base Sepolia (chainId 84532). Switch networks to see the live three-source comparison; this network only shows the MockOracle price.',

      column: {
        asset: 'Asset',
        mock: 'MockOracle (used by engine)',
        chainlink: 'Chainlink',
        pyth: 'Pyth',
      },

      dashNote:
        '"—" means that adapter can\'t provide a trusted price right now, for one of two reasons: (1) no feed exists for this asset (mostly stocks/ETFs — the Chainlink and Pyth testnets only cover mainstream crypto assets); (2) the price is stale or incomplete — the adapter is now fail-closed, so it reverts outright rather than returning a stale price when staleThreshold (1 hour by default) has elapsed without an update, the round is incomplete, or the Pyth confidence interval is too wide. So a row going from a number to "—" means that source degraded, not that its feed was removed.',
    },

    prices: {
      title: 'Asset Prices (8-decimal)',
      refresh: '↺ Refresh',
      lastUpdated: 'Last updated: {when}',
      updating: 'Updating…',
      update: 'Update Price',
    },

    raw: {
      title: 'Raw 8-decimal prices (for cast commands)',
    },
  },

  treasury: {
    connectWallet: 'Connect wallet to access Treasury Admin.',
    viewOnEtherscan: 'View on Etherscan ↗',

    /** 權限閘門。「還在讀鏈上 treasury」和「確定不是你」要說不同的話。 */
    checkingAuth: 'Checking permissions…',
    checkingAuthBody:
      "Reading feeRouter.platformTreasury() on-chain — if it can't be read, access stays denied.",
    notAuthorized: 'Not authorized',
    notAuthorizedBody: 'This page is restricted to the wallet set as feeRouter.platformTreasury().',
    treasuryFallbackLabel: 'Treasury (fallback display value):',
    treasuryOnChainLabel: 'Treasury (on-chain):',

    title: 'Treasury Admin',
    subtitle: 'Cash out accumulated platform fees → ETH',

    stat: {
      pendingFees: 'Pending Platform Fees',
      walletMusdc: 'Wallet USDC Balance',
      walletEth: 'Wallet ETH Balance',
      routerEth: 'Router ETH Reserve',
    },

    claim: {
      title: 'Claim Platform Fees from FeeRouter',
      treasury: 'Treasury: {address}',
      pending: 'Pending platform fees',
      claiming: 'Claiming…',
      cta: 'Claim Platform Fees',
      note: 'This transfers all accumulated platform-share fees (20% of each copy / performance fee) to your wallet.',
      done: 'Platform fees claimed ✓',
    },

    swap: {
      title: 'Convert USDC → ETH via SwapRouter',
      placeholder: 'USDC amount',
      max: 'Max',
      estimate: '≈ {eth} ETH (rate: 1 ETH = 3000 USDC)',
      routerInsufficient:
        'Router only has {amount} ETH available. Fund it using the Treasury Tools below before swapping.',
      approving: 'Approving…',
      approve: '① Approve USDC',
      approved: 'USDT approved ✓',
      swapping: 'Swapping…',
      swap: '② Swap to ETH',
      done: 'Swapped {amount} USDC → {eth} ETH ✓',
    },

    tools: {
      title: 'Treasury Tools',
      fundRouter: 'Fund SwapRouter with ETH',
      fundRouterDesc:
        'The router needs an ETH reserve to fulfill USDC→ETH swaps from users and admin.',
      currentReserve: 'Current reserve:',
      placeholder: 'ETH amount (e.g. 1)',
      funding: 'Funding…',
      cta: 'Fund Router',
      done: 'Funded router with {amount} ETH ✓',
    },

    incentives: {
      title: '🎁 Incentives Pool Refill',
      description:
        'Copy rewards, daily check-in, tier upgrades, and trade mining are all incentivized with PEPE. Keep this incentives contract stocked with enough PEPE to avoid a revert InsufficientPool error when users claim.',
      walletBalance: 'My Wallet PEPE Balance',
      poolBalance: 'Incentives Contract PEPE Reserve',
      placeholder: 'PEPE amount to fund (e.g. 100000)',
      funding: 'Funding…',
      cta: 'Confirm Funding',
      done: 'Successfully funded Incentives Pool with {amount} PEPE ✓',
    },

    history: {
      title: 'Recent Cash Out History',
      refresh: '↺ Refresh',
      emptyTitle: 'No cash out history yet',
      emptyDescription: 'Fee claims and USDC→ETH swaps will appear here.',
      claimed: 'Claimed',
      swapped: 'Swapped',
      claimAmount: '{amount} USDC',
      swapAmount: '{usdcIn} USDC → {eth} ETH',
    },

    info: {
      revenueModelLabel: 'Revenue model:',
      revenueModelBody:
        'Each copy-trade or performance fee is split 70% trader / 20% platform / 10% Insurance Vault. Platform fees accumulate in FeeRouter until this admin claims them.',
      swapNote:
        "After claiming USDC, use the swap above to convert to ETH at the mock rate (1 ETH = 3000 USDC). In production, you'd use a real DEX.",
    },
  },

  kyc: {
    connectWallet: 'Connect a wallet to use the review page.',

    checkingAuth: 'Checking permissions…',
    checkingAuthBody: 'Reading owner() and verifiers() on-chain. Access is denied until this resolves.',
    notAuthorized: 'Not authorized',
    notAuthorizedBody: 'This page is restricted to the KYCRegistry owner or an appointed reviewer.',

    roleOwner: 'You are here as the owner',
    roleVerifier: 'You are here as an appointed reviewer',

    /** Owner-only — see KYCRegistry.sol's setVerifier and docs/ROLE_SEPARATION.md. */
    verifierAdmin: {
      title: 'Appoint a Reviewer',
      body: 'An appointed address can approve/revoke KYC as a reviewer — the owner does not need to stay online.',
      addressLabel: 'Reviewer address',
      addressPlaceholder: '0x…',
      invalidAddress: 'Enter a valid address',
      assign: 'Appoint',
      assigning: 'Appointing…',
      assigned: 'Reviewer appointed ✓',
      revoke: 'Revoke appointment',
      revoking: 'Revoking…',
      revoked: 'Reviewer appointment revoked ✓',
    },

    title: 'KYC Review',
    subtitle: 'Review pending applications, check verification status, revoke verification.',

    notSecrecyNotice:
      "This page gates applicant data behind a permission check to avoid actively compiling it into a list — not because the data is secret. KYCRegistry is a public contract; anyone can scan the same on-chain events themselves.",

    queue: {
      readErrorSome: '{count} application(s) could not be read and are left out of the list — refresh to retry.',
      readErrorAll: 'Failed to load the review queue, possibly RPC rate-limiting. Refresh to retry.',
      /** A failed KYCSubmitted scan chunk is worse than a few unreadable rows — the queue itself may be missing applicants. */
      scanIncomplete: '{count} chunk(s) of the on-chain event scan failed — the queue may be incomplete (some applicants may be missing). Refresh to retry.',
      refresh: '↺ Refresh',
      scanRange: 'Scanned range: block {from} – {to}',
      scanning: 'Scanning on-chain events… ({done}/{total})',

      pendingTitle: 'Pending Applications',
      pendingEmpty: 'No pending applications right now.',

      /** See ADR 0005: accounts created via batchVerify never called submitKYC, so this list can't see them. */
      verifiedTitle: 'Verified (via review flow)',
      verifiedCaveat: 'Only addresses verified through the review flow (submit → approve) are listed. Seed accounts written directly via batchVerify never appear here, even though isVerified() is true for them.',
      verifiedEmpty: 'No addresses verified through the review flow yet.',

      revokedTitle: 'Revoked',
      revokedEmpty: 'No revoked addresses right now.',
      revokedNote: 'Revoking only blocks new regulated positions — existing positions can still be closed normally.',

      column: {
        address: 'Address',
        name: 'Name',
        nationality: 'Nationality',
        submitted: 'Submitted',
        screening: 'Screening',
        action: '',
      },

      approve: 'Approve',
      approving: 'Approving…',
      approved: 'Approved ✓',
      approveAllClean: 'Approve all clean applications ({count})',
      approveAllCleanBusy: 'Batch approving…',
      approveAllCleanDone: 'Batch-approved {count} application(s) ✓',
      /** approveKYCBatch has no per-item try/catch — one failure takes the whole batch down. */
      approveAllCleanFailedHint: 'Batch approval has no per-item fallback — one failure means none of the batch got approved. Use each row’s own "Approve" button to process them individually instead.',

      revoke: 'Revoke',
      revoking: 'Revoking…',
      revoked: 'Revoked ✓',

      /** See ADR 0004: this group only ever produces a recommendation — approveKYC is always a human's action. */
      screening: {
        disclaimer: 'Recommendations below come from a fictional demo policy (see kycScreening.ts) — they do not correspond to any real sanctions list or real jurisdiction risk, and exist only to demonstrate the review workflow.',
        clean: 'Clean',
        needsReview: 'Needs review',
        reasonUnclearJurisdiction: 'Jurisdiction not on the platform list',
        reasonWatchlistNameMatch: 'Name matches fictional watchlist',
      },
    },
  },

  agent: {
    connectWallet: 'Connect wallet to view the agent monitor.',
    title: '📊 Agent Risk Monitor',
    live: 'LIVE',
    subtitle:
      'Monitor the AI agent economy: delegated session budget usage, x402 revenue split, oracle health. Read-only.',

    disclosure:
      'Solvency backstop disclosure: ADL (auto-deleveraging) and cross margin are implemented and flag-gated; this testnet deployment currently has them disabled by default (production runs isolated-margin liquidation + Insurance Vault bailout). In extreme markets, the protocol carries solvency risk as counterparty before ADL is enabled — the numbers on this page do not guarantee solvency in production. See docs/RISK_NOTES.md.',

    kpi: {
      chain: 'Chain',
      activeSessions: 'Active sessions',
      staleFeeds: 'Stale feeds',
      vaultAssets: 'Vault assets (USDC)',
      vaultPrice: 'Vault px (USDC/pIV)',
      x402Fees: 'x402 fees (USD)',
    },

    sessions: {
      title: 'Delegated Sessions',
      refresh: '↺ Refresh',
      wrongNetwork:
        'Switch to Base Sepolia (chainId 84532) to view agent sessions. Current network: {chain}.',
      notConnected: 'Not connected',
      empty: 'No sessions yet.',

      column: {
        id: '#',
        user: 'User',
        agent: 'Agent',
        budgetUse: 'Budget use',
        maxLeverage: 'Max lev',
        expiry: 'Expiry',
        status: 'Status',
      },

      status: {
        revoked: 'Revoked',
        expired: 'Expired',
        highUse: 'High use',
        expiring: 'Expiring',
        active: 'Active',
      },
    },

    verification: {
      title: 'Agent Verification (ERC-8126)',
      description:
        '"Can this agent be trusted?" — four checks (ETV / SCV / WAV / WV) plus a unified 0–100 risk score (lower is safer), signed by a verifier.',
      inputLabel: 'Agent address or did:pkh',
      inputPlaceholder: '0x… or did:pkh:eip155:84532:0x…',
      enterQuery: 'Enter an agent address or did:pkh',
      verifying: 'Verifying…',
      verify: 'Verify',
      failed:
        'Verification failed ({error}). Check the signal-api URL, and see docs/AGENT_ECONOMY_STANDARDS.md.',
      fetchFailed: 'fetch failed',

      riskChip: 'Risk {score}/100 · {tier}',
      checkChip: '{type} {score}',
      checkNotApplicable: 'N/A',
      checkTooltip: '{name}: {details}',
      identity: 'subject: {subject} · verifier: {verifier}',
    },

    revenue: {
      title: 'x402 Revenue (70/20/10)',
      urlLabel: 'signal-api URL',
      fetch: 'Fetch',
      failed: 'Failed to connect to signal-api ({error}). Run npm run signal-api first.',
      callsTotal: 'Calls / Total',
      traderShare: 'Trader 70%',
      platformShare: 'Platform 20%',
      vaultShare: 'Vault 10%',
      topBeneficiaries: 'Top beneficiaries (70% share)',
      loading: 'Loading…',
    },

    oracle: {
      title: 'Oracle Health',
      column: {
        asset: 'Asset',
        price: 'Price',
        funding: 'Funding',
        feed: 'Feed',
      },
      stale: 'Stale',
      fresh: 'Fresh',
    },

    sessionManager: 'AgentSessionManager: {address}',
  },
};
