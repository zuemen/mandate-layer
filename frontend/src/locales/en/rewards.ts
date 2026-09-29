import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/rewards.ts`。
 */
export const rewards: Catalog['rewards'] = {
  connectWallet: 'Connect wallet to view your rewards.',
  connectTitle: '🎁 Rewards',

  title: '🎁 Rewards',
  subtitle: 'Trade, follow, and check-in daily to earn PEPE.',

  /** 合約沒部署在這條鏈上時，四個領取動作共用的同一句話。 */
  offline:
    "The PEPE rewards system isn't deployed on this network — claiming is temporarily unavailable.",

  tier: {
    bronze: 'Bronze 🥉',
    silver: 'Silver 🥈',
    gold: 'Gold 🥇',
    diamond: 'Diamond 💎',
  },

  mining: {
    title: 'Trade Mining',
    description:
      'Claimable once per position opened. Reward = notional × 0.5%, capped at 5,000 PEPE.',
    empty: 'No open positions found.',
    position: 'Position #{id}',
    detail: 'Notional: ${notional}',
    estReward: 'Est reward: {reward}',
    claimed: 'Claimed',
    claim: 'Claim',
    done: 'Trade mining claimed! 🎉',
  },

  tierSection: {
    title: 'Tier Upgrade',
    description: 'Claim a one-time tier reward once your cumulative volume hits the threshold.',
    cumulative: 'Cumulative notional: ${amount}',
    reward: '{amount} PEPE',
    required: '${amount} required',
    claimed: 'Claimed',
    claim: 'Claim',
    locked: 'Locked',
    done: '{tier} reward claimed! 🏆',
  },

  copy: {
    title: 'Copy Reward',
    description:
      'After a successful copy, both the copier and the copied trader each get 200 PEPE (once per pair).',
    empty: 'No active copy trades found.',
    claimed: 'Claimed',
    claim: '200 PEPE',
    done: 'Copy reward claimed! 200 PEPE each 🐸',
  },

  checkIn: {
    title: 'Daily Check-in',
    description:
      'Check in daily for 50 PEPE; each consecutive day adds +10 PEPE, capped at 110 PEPE after 7 days.',
    streak: '🔥 {days} day streak',
    todayReward: "Today's reward: {reward} PEPE",
    /** 按鈕的兩種狀態各自是完整的一句話，不是「簽到 +」加金額。 */
    alreadyCheckedIn: '✓ Checked in today',
    checkIn: '🐸 Check in +{reward} PEPE',
    comeBack: "Come back tomorrow! Tomorrow's reward: {reward} PEPE",
    done: 'Checked in! 🐸',
  },

  /** 交易正在跑的時候按鈕上的字。 */
  working: '…',

  /** PEPE 餘額與空投領取卡（PepeTokenCard，從舊版首頁搬到這一頁）。 */
  pepeToken: {
    label: '🐸 PEPE Token',
    subtitle: 'Pepe RWA Token · claim the airdrop once your KYC is approved',
    addToWallet: 'Add to wallet',
    reloadAria: 'Reload PEPE balance',
    notAvailable: 'PEPE is not available on this network (contracts not deployed here).',

    balance: 'Balance',
    airdrop: 'Airdrop',
    claimed: '✓ Claimed',
    poolEmpty: 'Pool empty',
    claiming: 'Claiming…',
    claim: 'Claim {amount} PEPE',
    kycTooltip:
      'Requires an approved KYC application (submitting is not the same as being approved)',
    kycRequired:
      'Requires approved KYC — submitting an application is not the same as being approved',

    notDeployed: 'PepeToken is not deployed on this network.',
  },
};
