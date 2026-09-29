import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/agentMode.ts`。
 */
export const agentMode: Catalog['agentMode'] = {
  title: 'Agent Mode',
  subtitle: 'What the AI agent did on chain — read straight from Base Sepolia. No wallet needed.',
  howTitle: 'How it works in four steps',
  how: [
    'The user opens a capped session and signs an EIP-712 authorization credential (VC) for the agent.',
    'The agent pays for signals in USDC over x402, at the HTTP layer; the money goes straight to the seller.',
    'The agent can only trade inside the caps. Over the cap, or after revocation, the contract itself says no.',
    'With a Base Account, a Base Spend Permission also caps how much margin can leave the wallet each day; Coinbase’s own contract refuses more. See the recorded run below.',
  ],
  refresh: 'Refresh',
  loading: 'Reading on-chain data…',
  scanWindow: 'Scan window: last {window}',
  readError: 'Read failed: {error}',
  unreadable: 'Could not be read from the chain (see the error above). Try Refresh.',

  payments: {
    title: 'x402 payments',
    caption: 'Circle USDC sent from agents to the signal seller {seller}, on chain. Each row is one HTTP 402 payment.',
    empty: 'No payments in the scan window. See the recorded demo run below.',
    colFrom: 'Payer (agent)',
    colAmount: 'Amount',
    colTx: 'Transaction',
  },

  sessions: {
    title: 'Session caps (enforced on chain)',
    caption: 'Each session is a hard limit set by the user and checked by AgentSessionManager on every order.',
    empty: 'No sessions yet.',
    colId: '#',
    colAgent: 'Agent',
    colPerTrade: 'Per-trade cap',
    colBudget: 'Spent / budget',
    colLeverage: 'Max leverage',
    colExpiry: 'Expires',
    colStatus: 'Status',
    active: 'Active',
    revoked: 'Revoked',
    expired: 'Expired',
  },

  activity: {
    title: 'Agent actions (session events)',
    empty: 'No session events in the scan window.',
    opened: 'Opened #{position} (margin {margin})',
    closed: 'Closed #{position}',
    revoked: 'User revoked the session',
  },

  tryIt: {
    title: 'Try it: make the agent break its cap',
    caption:
      'Simulates, with eth_call, the agent of session #{session} placing an order with margin {margin} (cap {cap}), or an order on an asset outside the session’s allow-list. Nothing is sent and no key is needed — what comes back is the contract’s own rejection.',
    button: 'Simulate over-cap order',
    buttonAsset: 'Simulate off-list asset order',
    noSession: 'At least one session is needed to run this.',
    rejected: 'Rejected by the contract: {reason}',
    noReason: 'no reason given',
    simulationFailed: 'Could not simulate this order (network or RPC error, not a contract rejection): {reason}',
    accepted: 'The contract did not reject it — this should not happen, please report it.',
  },

  spendRun: {
    title: 'Base Account + Spend Permission (recorded run)',
    inApp: 'Steps 3 and 4 are one button in the app, for your own Base Account:',
    inAppLink: 'Agent Sessions, Fund the agent from a Base Account',
    inAppNoWallet: 'connect a wallet, then open Agent Sessions and use Fund the agent from a Base Account.',
    caption:
      'A Base Account (Coinbase Smart Wallet) funds the agent through a Base Spend Permission: at most {allowance} mUSDC per day can leave the wallet, and only into its own margin. The session then bounds what the agent does with it. Latest run of agent/examples/spend-permission-demo.ts ({at}).',
  },

  recorded: {
    title: 'Latest recorded demo run (including rejected transactions)',
    caption:
      'Rejected transactions emit no events, so they cannot be scanned from logs. This is the latest run of agent/examples/e2e-demo.ts ({at}), with a BaseScan link for every step.',
    colStep: 'Step',
    colActor: 'Actor',
    colAction: 'Action',
    colResult: 'Result',
    colTx: 'Transaction',
    offChain: 'off-chain',
  },
};
