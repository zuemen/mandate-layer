// AgentSessionManager（Phase 2 session-key 委派層）位址 + 合約工廠。
//
// 刻意獨立於 addresses.ts 的 ChainAddresses（該介面由 deploy 腳本整段重寫，
// 尚未納入此合約）。部署後請把 Deploy.s.sol 印出的 "AgentSessionMgr :" 位址
// 填到下面對應鏈，頁面即會啟用。位址為 0x0 時頁面顯示「未部署」提示。
import type { Signer, BrowserProvider } from 'ethers'

import { Contract } from 'ethers'

import AgentSessionManagerABI from 'src/contracts/abi/AgentSessionManager.json'

const ZERO = '0x0000000000000000000000000000000000000000'

// chainId → AgentSessionManager 位址（部署後填入）
const SESSION_MANAGER_ADDRESS: Record<number, string> = {
  31337:    ZERO, // Anvil：跑 deploy-anvil.sh 後填入
  11155111: ZERO, // Sepolia：跑 deploy-sepolia.sh 後填入
  // Base Sepolia — mandate-layer's own AgentSessionManager (Deploy.s.sol,
  // 2026-09-23), bound to this repo's exchange 0xC45dEd77…3B0E and the only
  // agent that exchange authorizes. The original project's managers are
  // intentionally not referenced.
  84532:    '0x71125e25c903AD4e198e1863d5Bf26df97926CDe',
}

export function getSessionManagerAddress(chainId: number | null): string {
  if (chainId === null) return ZERO
  return SESSION_MANAGER_ADDRESS[chainId] ?? ZERO
}

export function isSessionManagerDeployed(chainId: number | null): boolean {
  return getSessionManagerAddress(chainId) !== ZERO
}

/** 建立 AgentSessionManager 合約實例；位址未部署時回 null。 */
export function getSessionManager(
  runner: Signer | BrowserProvider | null,
  chainId: number | null,
): Contract | null {
  if (!runner) return null
  const addr = getSessionManagerAddress(chainId)
  if (addr === ZERO) return null
  return new Contract(addr, AgentSessionManagerABI, runner)
}

export { AgentSessionManagerABI }
