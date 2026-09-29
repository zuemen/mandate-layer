// 事件掃描（getLogs）的單一真相來源：掃描範圍、出塊時間、分段查詢。
import { JsonRpcProvider } from 'ethers'

//
//
// 之前 WhaleTrackerPage 把 `DEPLOY_BLOCK = 10_874_200` 寫死——那是 **Ethereum
// Sepolia** 的區塊。連到 Base Sepolia（2 秒一塊、高度數千萬）時，它會從一個
// 五千萬塊以前的位置開始，用 9,900 塊為單位串行 getLogs，等於幾千次 RPC：頁面
// 卡住幾分鐘，公共節點直接限流。useWhaleAlerts 則反過來，單發一次 50,000 塊的
// queryFilter（多數節點的上限是 10k）並用 12 秒/塊估時間，在 Base 上把時間高估
// 六倍。
//
// 這裡把「從哪一塊開始掃」「一塊多久」變成依 chainId 查表的純函式，讓兩邊共用
// 同一份答案，也讓它可以被測試。

/**
 * 各鏈的合約部署塊。掃描永遠不需要早於這裡，因為在那之前不可能有事件。
 * 沒有列出的鏈 → undefined，改用滾動視窗（見 scanFromBlock）。
 */
export const DEPLOY_BLOCK_BY_CHAIN: Record<number, number> = {
  // Anvil 每次重啟都從 0 開始。
  31337: 0,
  // Ethereum Sepolia：Exchange + Seed 的部署塊。
  11155111: 10_874_200,
  // Base Sepolia：contracts/broadcast/Deploy.s.sol/84532/run-1790157165167.json 的第一筆 receipt。
  84532: 47_194_407, // mandate-layer own deployment (2026-09-23)
}

/** 各鏈的實際出塊時間（秒）。用它把「N 塊以前」換算成時間，反之亦然。 */
export const AVG_BLOCK_TIME_BY_CHAIN: Record<number, number> = {
  31337: 1, // 本地鏈只在有交易時出塊，1 是保守估計
  11155111: 12, // Ethereum Sepolia
  84532: 2, // Base Sepolia（OP Stack，2 秒）
}

/** 不認得的鏈用 12 秒——高估比低估安全，寧可掃少一點也不要炸掉節點。 */
export const DEFAULT_AVG_BLOCK_TIME = 12

/** 預設只回看 7 天。這是「近期鯨魚動向」需要的範圍，不是完整鏈史。 */
export const DEFAULT_SCAN_WINDOW_SEC = 7 * 24 * 3600

/**
 * 單次 getLogs 的塊數上限。Infura / Alchemy 的公開端點是 10,000，
 * 留一點餘裕避免邊界剛好被拒。
 */
export const CHUNK_SIZE = 9_900

/**
 * 一次掃描最多切幾段。就算視窗算出來很大，也不讓頁面送出上百次 RPC；
 * 超過就從尾端截斷（保留最新的區塊，那才是使用者在看的東西）。
 */
export const MAX_CHUNKS = 40

export function avgBlockTime(chainId: number | null | undefined): number {
  if (chainId === null || chainId === undefined) return DEFAULT_AVG_BLOCK_TIME
  return AVG_BLOCK_TIME_BY_CHAIN[chainId] ?? DEFAULT_AVG_BLOCK_TIME
}

/** 把一段時間換算成該鏈的塊數。 */
export function blocksForSeconds(chainId: number | null | undefined, seconds: number): number {
  return Math.max(1, Math.ceil(seconds / avgBlockTime(chainId)))
}

export function deployBlock(chainId: number | null | undefined): number | undefined {
  if (chainId === null || chainId === undefined) return undefined
  return DEPLOY_BLOCK_BY_CHAIN[chainId]
}

/**
 * 掃描起點。
 *
 * 規則：滾動視窗（現在往回 windowSec）與部署塊取「較晚」的那個。
 *  - 部署塊已知且很近（剛部署的鏈）→ 不會掃到部署之前的空白區。
 *  - 部署塊已知但很遠（Base 上已經跑了幾個月）→ 視窗把它夾住，不會退化成掃全鏈。
 *  - 部署塊未知（新鏈 / 沒登記）→ 純滾動視窗，仍然有界。
 *
 * 另外硬性套用 MAX_CHUNKS：任何情況下切出來的段數都不會超過上限。
 */
export function scanFromBlock(a: {
  chainId: number | null | undefined
  currentBlock: number
  windowSec?: number
  maxChunks?: number
}): number {
  const windowSec = a.windowSec ?? DEFAULT_SCAN_WINDOW_SEC
  const maxChunks = a.maxChunks ?? MAX_CHUNKS
  const current = Math.max(0, Math.floor(a.currentBlock))

  const windowStart = Math.max(0, current - blocksForSeconds(a.chainId, windowSec))
  const dep = deployBlock(a.chainId)
  // 部署塊比節點回報的鏈高度還大 = 我們認錯鏈了（本地 fork、重置的 Anvil、
  // RPC 指到別條鏈）。這時不能拿部署塊當起點，退回滾動視窗。
  const usableDeploy = dep !== undefined && dep <= current ? dep : undefined
  let from = usableDeploy === undefined ? windowStart : Math.max(usableDeploy, windowStart)

  // 硬上限：不論上面算出什麼，段數都不能超過 maxChunks。
  const hardFloor = Math.max(0, current - maxChunks * CHUNK_SIZE + 1)
  if (from < hardFloor) from = hardFloor

  return Math.min(from, current)
}

/**
 * 把 [from, to] 切成不超過 CHUNK_SIZE 的閉區間清單。
 * 分開成純函式是為了能直接測邊界——off-by-one 在這裡會靜默漏掉整塊事件。
 */
export function chunkRanges(
  from: number,
  to: number,
  size: number = CHUNK_SIZE,
): Array<[number, number]> {
  if (to < from) return []
  const step = Math.max(1, Math.floor(size))
  const out: Array<[number, number]> = []
  for (let start = from; start <= to; start += step) {
    out.push([start, Math.min(start + step - 1, to)])
  }
  return out
}

/**
 * 給 UI 顯示用：這次掃了多久的鏈史。
 *
 * 輸出英文——whale tracker 的介面統一英文，而這個字串是直接印在畫面上的，
 * 不是給人讀的除錯訊息。
 */
export function describeScanWindow(chainId: number | null | undefined, blocks: number): string {
  const sec = blocks * avgBlockTime(chainId)
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`
  return `${(sec / 86400).toFixed(1)}d`
}

// ── 分段查詢 ─────────────────────────────────────────────────────────────────
// `Contract` 只當型別用（import type 在編譯後會被抹掉），所以這個檔案在測試裡
// 不會把 ethers 拉進來。

/**
 * 分段掃 getLogs 期間的進度回報。一次掃描可能是 40 段序列 RPC，在 UI 上
 * 只顯示一句「載入中」等於讓使用者對著不動的畫面猜還要多久。
 * 每一段結束都會叫一次，**包含失敗的那些**——進度講的是做完的工作量，
 * 不是成功的筆數，否則遇到節點暫時性錯誤進度條會卡住不動。
 */
export type ChunkProgress = (done: number, total: number) => void

/**
 * 分段掃**原始** getLogs，一次帶多個事件 topic。
 *
 * 存在的理由是實測出來的：whale tracker 要 PositionOpened / Closed /
 * Liquidated 三種事件，用三個 `contract.queryFilter` 就是三趟各 31 段＝93 次
 * getLogs，在 Base Sepolia 的公開節點上足以讓同時間的其他請求（包括
 * `getBlock('latest')`）直接失敗。
 *
 * topics[0] 可以是一個陣列，語意是 OR。所以同一個合約上的三種事件可以合成
 * 一趟掃完——31 次而不是 93 次。呼叫端拿到原始 log 之後用 `interface.parseLog`
 * 還原成具名事件。
 */
/**
 * Large-range log RPCs per chain, used only when a chunk fails on the caller's own
 * provider. Wallet RPCs for Base Sepolia default to sepolia.base.org, which caps
 * eth_getLogs at 1,000 blocks (measured 2026-09-23) — every CHUNK_SIZE request there
 * fails. Tenderly's public gateway answered a 3,000,000-block range with CORS open.
 * Only chains listed here fall back, and only after confirming the caller's chain id,
 * so a local Anvil chain never gets logs from another network.
 */
export const LOG_FALLBACK_RPC: Record<number, string> = {
  84532: 'https://base-sepolia.gateway.tenderly.co',
}

type FallbackLogProvider = JsonRpcProvider

const fallbackCache = new Map<number, JsonRpcProvider>()

async function fallbackLogProvider(provider: unknown): Promise<FallbackLogProvider | null> {
  try {
    const net = await (provider as { getNetwork?: () => Promise<{ chainId: bigint }> })?.getNetwork?.()
    const chainId = net ? Number(net.chainId) : NaN
    const url = LOG_FALLBACK_RPC[chainId]
    if (!url) return null
    if (!fallbackCache.has(chainId)) {
      fallbackCache.set(chainId, new JsonRpcProvider(url, chainId, { staticNetwork: true }))
    }
    return fallbackCache.get(chainId)!
  } catch {
    return null
  }
}

export async function getLogsChunked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: { getLogs: (f: any) => Promise<any[]> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: { address?: string; topics?: any[] },
  fromBlock: number,
  toBlock: number,
  onChunk?: ChunkProgress,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const ranges = chunkRanges(fromBlock, toBlock)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  let done = 0
  let fallback: FallbackLogProvider | null | undefined
  for (const [from, to] of ranges) {
    try {
      all.push(...(await provider.getLogs({ ...filter, fromBlock: from, toBlock: to })))
    } catch (e) {
      fallback = fallback === undefined ? await fallbackLogProvider(provider) : fallback
      try {
        if (!fallback) throw e
        all.push(...(await fallback.getLogs({ ...filter, fromBlock: from, toBlock: to })))
      } catch {
        console.warn('[getLogsChunked] chunk failed', from, '-', to, e)
      }
    }
    done += 1
    onChunk?.(done, ranges.length)
  }
  return all
}

/**
 * 一段查詢失敗時回報，讓呼叫端可以決定「靜默丟棄可以接受」還是「必須讓使用者
 * 知道結果不完整」——兩種呼叫端都存在，所以這是選擇性的，不是強制的。
 */
export type ChunkFailure = (from: number, to: number, error: unknown) => void

/**
 * 分段掃 getLogs，單段不超過 CHUNK_SIZE。
 * 單段失敗只丟掉那一段（節點暫時性錯誤很常見），不讓整次查詢歸零。
 * 呼叫端若在乎「掉了幾段」（例如結果會拿去判斷某個清單是否完整），
 * 傳 onChunkFailed 取得每一段失敗的通知；不傳就是舊行為，只印 console.warn。
 */
export async function queryLogsChunked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contract: { queryFilter: (f: any, from: number, to: number) => Promise<any[]> },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: any,
  fromBlock: number,
  toBlock: number,
  onChunk?: ChunkProgress,
  onChunkFailed?: ChunkFailure,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const ranges = chunkRanges(fromBlock, toBlock)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  let done = 0
  let fallback: FallbackLogProvider | null | undefined
  for (const [from, to] of ranges) {
    try {
      all.push(...(await contract.queryFilter(filter, from, to)))
    } catch (e) {
      // Same fallback as getLogsChunked, through the contract re-bound to the log RPC.
      const c = contract as { connect?: (r: unknown) => typeof contract; runner?: { provider?: unknown } }
      fallback = fallback === undefined ? await fallbackLogProvider(c.runner?.provider) : fallback
      try {
        if (!fallback || typeof c.connect !== 'function') throw e
        all.push(...(await c.connect(fallback).queryFilter(filter, from, to)))
      } catch {
        console.warn('[queryLogsChunked] chunk failed', from, '-', to, e)
        onChunkFailed?.(from, to, e)
      }
    }
    done += 1
    onChunk?.(done, ranges.length)
  }
  return all
}
