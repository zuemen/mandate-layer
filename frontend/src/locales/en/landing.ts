import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/landing.ts`。
 */
export const landing: Catalog['landing'] = {
  tagline: 'Bounded AI agents · On-chain derivatives',
  brandLine: 'agent mandates enforced on chain · on Base',
  enterDashboard: 'Enter Dashboard',
  viewTraders: 'View Traders',
  agentModeCta: 'See the agent in action →',
  connectHint: 'Connect to browse every feature directly — no account required.',

  paperTrading: {
    title: 'What is Paper Trading?',
  },

  features: {
    heading: 'Core Features',

    rwaTitle: 'Tokenized RWA Spot',
    rwaDesc:
      'Buy and sell tokenized equities, bonds, gold, and crypto with USDC — minted and redeemed on-chain, with the reserve ratio always visible.',

    perpetualsTitle: 'Advanced: Synthetic Perpetuals (optional)',
    perpetualsDesc:
      'Synthetic perpetuals for anyone who wants to hedge long against short. Leverage is off by default, and everything settles transparently on-chain.',

    copyTitle: 'One-Click Copy Trading',
    copyDesc:
      'Copy top traders in one click — approve USDC once and positions open automatically, sized to your allocation.',

    esgTitle: 'ESG Scoring',
    esgDesc: 'Every trader carries an ESG score, so investing comes with more accountability and transparency.',

    vaultTitle: 'Insurance Vault',
    vaultDesc:
      'Provide liquidity to earn protocol fees, while it doubles as an insurance pool against extreme losses.',

    x402Title: 'x402 Paid Signals',
    x402Desc: 'Agents bring their own wallet and pay per call for trading signals, with revenue split 70/20/10 on-chain.',

    agentTitle: 'Agent-Native Trading',
    agentDesc:
      'A bounded session key delegation — once an AI agent pays, it can autonomously open limited on-chain positions.',
  },

  steps: {
    heading: 'How to Get Started',
    one: 'Install MetaMask and switch to the Base Sepolia testnet',
    two: 'Go to Exchange and click "Get 1000 USDC" for test funds',
    three: 'Go to Assets, buy sGOLD and sBOND, then check Portfolio for the allocation and PnL across all four classes',
    four: '(Optional) Copy a trader on Marketplace, or register as one on the Trader page',
  },

  oracleDisclosure: 'Testnet prices are written by a single keeper key from CoinGecko and Yahoo Finance quotes; that key could write any value. This is a prototype, not a price feed to rely on.',

  /** 首頁最上方的即時 KPI 條（HeroKpiStrip）。網路名稱、chainId 是技術識別碼，不譯。 */
  heroKpi: {
    x402Revenue: 'x402 Revenue',
    agentCallsPaid: 'Agent Calls Paid',
    openInterest: 'Open Interest',
    network: 'Network',
    connectHint: 'connect ↗',
    onChainHint: 'on-chain log ↗',
  },

  /** #36：主視覺介紹與 Paper Trading 說明，各自拆成 `<b>` 前後的片段。 */
  markup: {
    heroBefore:
      'Give an AI agent a trading mandate — per-trade margin, total budget, max leverage, allowed assets, expiry — and a contract on Base checks every order against it. The agent buys its market data per call with ',
    heroBold: 'x402 paid signals',
    heroAfter: ' in USDC. The same app also offers tokenized equities, bonds, gold and crypto, all on Base Sepolia.',

    paperBefore: 'This platform uses ',
    paperBold1: 'testnet tokens',
    paperMid:
      ' for simulated trading, so users can try RWA investing, social copy trading and AI agent trading without real money. ',
    paperBold2: 'Prices follow real-market quotes',
    paperAfter:
      " written by a keeper; the funds are simulated assets and no real money is involved, much like TradingView's Paper Trading mode.",
  },
};
