import type { Catalog } from '../zh-TW';

/**
 * 見 `../zh-TW/pepe.ts`。
 */
export const pepe: Catalog['pepe'] = {
  /** 舊版全身造型（商店與收藏頁）。 */
  skin: {
    'skin-01': {
      name: 'Interstellar Explorer Pepe',
      desc: 'An elite Pepe explorer drifting between the stars and the DeFi void, laser sword in hand, sworn to push the lab into deep space!',
    },
    'skin-02': {
      name: 'Master Chef Pepe',
      desc: 'A Pepe who loves cooking up steaks and tender greens, always ready to serve the ultimate DeFi feast!',
    },
    'skin-03': {
      name: 'Shadow Ninja Warrior',
      desc: 'A deadly ninja lurking in the shadows, lightning-fast, able to slip through an army and complete a swap without a trace.',
    },
    'skin-04': {
      name: 'Bling King Pepe',
      desc: 'A hip-hop Pepe dripping in a gold chain and vintage shades — the center of attention wherever the stage is.',
    },
    'skin-05': {
      name: 'Wild Pirate Captain',
      desc: 'Captain of the endless DeFi seas, cutlass in hand, sailing toward Treasure Island on instinct no one else has.',
    },
    'skin-06': {
      name: 'Sorcerer King Pepe',
      desc: 'Seated on a sacred throne, wielding ancient green nature magic — the ultimate frog sovereign, revered by all.',
    },
    'skin-07': {
      name: 'Space Marine Pepe',
      desc: 'A Pepe suited up in heavy high-tech space armor with a jetpack on its back, ready to launch toward the moon!',
    },
    'skin-08': {
      name: 'Cyberpunk Machine Frog',
      desc: 'A cybernetic frog from a neon-lit future city, running on fiber-optic nerves and a supercomputer brain, reading the market in milliseconds.',
    },
    'skin-09': {
      name: 'Business Elite Pepe',
      desc: 'A sharply-suited, mature Pepe radiating executive presence — synonymous with steady investing and a high win rate.',
    },
    'skin-10': {
      name: 'Temple Cross Knight',
      desc: "A brave knight wielding a great cross-sword and holy shield, sworn to defend the DeFi temple's assets to the death.",
    },
    'skin-11': {
      name: 'Legendary Boxing Champ',
      desc: 'A bandaged, red-gloved king of the ring who can land a knockout blow on the bears in a single instant!',
    },
    'skin-12': {
      name: 'Neon Party DJ Pepe',
      desc: 'A trendsetting DJ spinning at a massive neon rave — its sense of rhythm is as precise as perfectly minimized slippage.',
    },
    'skin-13': {
      name: 'Berserker Viking Frog',
      desc: 'A northern Viking warrior with a great double-bladed axe and horned helm, roaring through the waves to conquer new ground.',
    },
    'skin-14': {
      name: 'Crimson Honor Samurai',
      desc: 'A Japanese samurai frog in exquisite crimson armor, its blade drawn like thunder — living the absolute focus of bushido.',
    },
    'skin-15': {
      name: 'Elite Commander Pepe',
      desc: 'A stern military leader with a chest full of medals, master of flawless strategy from the macro view.',
    },
    'skin-16': {
      name: 'Arcane Grand Wizard',
      desc: 'A grand wizard chanting fantastic spells over an ice-blue staff, master of the secret art of conjuring liquidity from thin air.',
    },
    'skin-17': {
      name: 'Tech Agent Pepe',
      desc: 'A special-ops Pepe in a tactical vest and infrared night-vision goggles, expert at high-difficulty infiltrations in the dark.',
    },
    'skin-18': {
      name: 'Deep Forest Ranger',
      desc: 'An elegant archer living in seclusion in the deep green valleys — never misses, its arrow a symbol of precise target tracking.',
    },
    'skin-19': {
      name: 'Geek Hacker Frog',
      desc: 'A hacker frog in glowing iridescent goggles, moving through virtual mainframes — code weaves its entire kingdom.',
    },
    'skin-20': {
      name: 'Psychedelic Anime Pepe',
      desc: 'A cartoon Pepe in bold, vivid colors and street-camo style, bursting with youthful energy.',
    },
    'skin-21': {
      name: 'Fantasy Forest Hero',
      desc: 'A little fantasy frog hero with a pack on its back and a wooden sword, always ready for a strange new adventure toward massive profit.',
    },
    'skin-22': {
      name: 'Overclocked Mech Pepe',
      desc: 'A Pepe fully merged with a giant powered exoskeleton, output redlined — synonymous with heavy firepower!',
    },
    'skin-23': {
      name: 'Gala Regalia Pepe King',
      desc: 'A frog king in a lavish red embroidered ceremonial robe, attending a sacred festival — a symbol of power and the purest golden age.',
    },
    'skin-24': {
      name: 'Classical Elf Archer',
      desc: 'A classical elven frog archer bathed in sunlight, in perfect resonance with the spirits of nature — a mind still as a mirror.',
    },
    'skin-25': {
      name: 'Classic Sketch Pepe',
      desc: 'The original Pepe, rendered in rustic 2D hand-drawn ink lines and watercolor — a reminder of where the sincerity began.',
    },
  },

  /** 坐騎。 */
  mount: {
    leaf: {
      name: 'Lotus Leaf',
      desc: "A dew-covered lotus leaf — every Pepe frog's first journey begins here.",
    },
    carpet: {
      name: 'Magic Carpet',
      desc: 'A flying carpet woven with ancient runes, carrying you over the first wall on-chain.',
    },
    bitcoin: {
      name: 'BitCoin Rider',
      desc: "Rolling forward on a Bitcoin coin — a sign you've finally read this market.",
    },
    whale: {
      name: 'Celestial Whale',
      desc: 'The legendary golden celestial whale — only a true whale can ride it.',
    },
  },

  /**
   * 進化階段。title 是形態的完整名字，label 是畫面上簡寫的那一個，兩者都會被渲染
   * （title 用在角色名下方的小標題，以及進化成功彈窗的「進化 Lv.{stage} · {title}」）。
   */
  evolution: {
    stage0: {
      title: 'Pepe Egg 🥚',
      label: 'Egg',
      desc: 'A mysterious egg glowing green, resting on a pile of PEPE coins waiting to hatch.',
    },
    stage1: {
      title: 'Tadpole Pepe 🐟',
      label: 'Tadpole',
      desc: 'A tadpole just out of the shell, tail flicking as it swims for the first time in the on-chain glow.',
    },
    stage2: {
      title: 'Baby Pepe 🐸',
      label: 'Baby',
      desc: 'A baby frog with new legs, diapered up and standing on its first stage.',
    },
    stage3: {
      title: 'Rookie Trader 📈',
      label: 'Rookie',
      desc: 'In a hoodie and sneakers, phone screen full of green candles — a rookie trader on the come-up.',
    },
    stage4: {
      title: 'Elite Chad Trader 🕶️',
      label: 'Elite',
      desc: 'Shades, black leather, and a gold PEPE chain — a Wall Street-tier whale.',
    },
    stage5: {
      title: 'Gold Emperor Pepe 👑',
      label: 'Emperor',
      desc: 'Golden crown, crimson robes, and a jeweled scepter, standing atop a mountain of coins and gems.',
    },
    stage6: {
      title: 'Supreme Pepe Lord 😇',
      label: 'Lord',
      desc: 'Sprouting holy wings and a golden halo, robed in gold-trimmed white — the ultimate ascended form.',
    },

    /** 進化圖上的輔助文字。 */
    lockedAria: 'Locked — requires Lv.{level}',
    imageAlt: '{label} — Evolution Lv.{stage}',
  },

  /** issue #101: achievements unlock on holding time, portfolio carbon, diversification and days untouched — not on how much was bought. */
  achievement: {
    ach_hold_30: { title: 'Held a Month', desc: 'Hold one position for 30 days' },
    ach_hold_90: { title: 'A Quarter Untouched', desc: 'Hold one position for 90 days' },
    ach_low_carbon: { title: 'Low-Carbon Portfolio', desc: 'Weighted carbon intensity below 1 tCO2e/$M revenue' },
    ach_diversified: { title: 'Diversified', desc: 'Holdings diversification of 0.7 or higher' },
    ach_steady: { title: 'Steady Hand', desc: '30 days with no buy or sell' },
    ach_steward: { title: 'Long-Term Steward', desc: 'Held for 90 days, low-carbon and well diversified' },
  },

  /** 每日任務。獎勵金額會變的那一條用具名佔位符。 */
  quest: {
    q_checkin: { title: 'Daily Check-in', reward: '+{amount} achievement points' },
    q_trade: { title: 'Open a New Position', reward: '+25 achievement points' },
    q_balance: { title: 'Hold 100 PEPE', reward: 'Unlocks achievement' },
    q_streak3: { title: '3-Day Check-in Streak', reward: 'Unlocks achievement' },
  },
};
