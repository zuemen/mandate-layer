/**
 * Rewards 頁：交易挖礦、等級獎勵、跟單獎勵、每日簽到。
 *
 * 等級名稱（Bronze 🥉 / Silver 🥈 / Gold 🥇 / Diamond 💎）進 catalog：它們是畫面上
 * 讀得到的字，不是代幣代號。門檻與獎勵金額不進——那是數字。
 */
export const rewards = {
  connectWallet: '連接錢包以查看你的獎勵。',
  connectTitle: '🎁 獎勵',

  title: '🎁 獎勵',
  subtitle: '交易、跟單、每日簽到，賺取 PEPE。',

  /** 合約沒部署在這條鏈上時，四個領取動作共用的同一句話。 */
  offline: 'PEPE 獎勵系統尚未部署在此網路，暫時無法領取',

  tier: {
    bronze: 'Bronze 青銅 🥉',
    silver: 'Silver 白銀 🥈',
    gold: 'Gold 黃金 🥇',
    diamond: 'Diamond 鑽石 💎',
  },

  mining: {
    title: '交易挖礦',
    description: '每筆開倉可領一次。獎勵 = 名義價值 × 0.5%，封頂 5,000 PEPE。',
    empty: '找不到未平倉部位。',
    position: '部位 #{id}',
    detail: '名義價值：${notional}',
    estReward: '預估獎勵：{reward}',
    claimed: '已領取',
    claim: '領取',
    done: '交易挖礦獎勵已領取！🎉',
  },

  tierSection: {
    title: '等級獎勵',
    description: '累積交易量達標即可領取一次性等級獎勵。',
    cumulative: '累積名義價值：${amount}',
    reward: '{amount} PEPE',
    required: '需要 ${amount}',
    claimed: '已領取',
    claim: '領取',
    locked: '未達標',
    done: '{tier} 獎勵已領取！🏆',
  },

  copy: {
    title: '跟單獎勵',
    description: '跟單成功後，跟單者與被跟單者各領 200 PEPE（每對一次）。',
    empty: '找不到進行中的跟單。',
    claimed: '已領取',
    claim: '200 PEPE',
    done: '跟單獎勵已領取！雙方各得 200 PEPE 🐸',
  },

  checkIn: {
    title: '每日簽到',
    description: '每日簽到領 50 PEPE，連續簽到每天 +10 PEPE，7 天封頂 110 PEPE。',
    streak: '🔥 連續簽到 {days} 天',
    todayReward: '今日獎勵: {reward} PEPE',
    /** 按鈕的兩種狀態各自是完整的一句話，不是「簽到 +」加金額。 */
    alreadyCheckedIn: '✓ 今天已簽到',
    checkIn: '🐸 簽到 +{reward} PEPE',
    comeBack: '明天再來！明日獎勵: {reward} PEPE',
    done: '簽到成功！🐸',
  },

  /** 交易正在跑的時候按鈕上的字。 */
  working: '…',

  /** PEPE 餘額與空投領取卡（PepeTokenCard，從舊版首頁搬到這一頁）。 */
  pepeToken: {
    label: '🐸 PEPE 代幣',
    subtitle: 'Pepe RWA 代幣 · KYC 核准後即可領取空投',
    addToWallet: '加入錢包',
    reloadAria: '重新載入 PEPE 餘額',
    notAvailable: '此網路無法使用 PEPE（合約尚未部署）。',

    balance: '餘額',
    airdrop: '空投',
    claimed: '✓ 已領取',
    poolEmpty: '獎池已空',
    claiming: '領取中…',
    claim: '領取 {amount} PEPE',
    kycTooltip: '需要已核准的 KYC 申請（送出申請不等於已核准）',
    kycRequired: '需要已核准的 KYC——送出申請不等於已核准',

    notDeployed: 'PepeToken 尚未在此網路部署。',
  },
};
