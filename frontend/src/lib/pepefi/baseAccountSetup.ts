// One batch from a Base Account (Coinbase Smart Wallet) that sets up a funded, bounded agent:
//   1. approve a Base Spend Permission to SpendPermissionMarginFunder (margin token, per period)
//   2. name the agent as the account's top-up agent on the funder
//   3. open an AgentSessionManager session for the agent with an asset allow-list
// The encoding is pinned by a test to the batch that succeeded on Base Sepolia on 2026-09-24
// (tx 0x7f6939cd…). Sent with EIP-5792 wallet_sendCalls so the wallet executes it atomically.
import { ethers } from 'ethers'

/** Coinbase's SpendPermissionManager (github.com/coinbase/spend-permissions), Base and Base Sepolia. */
export const SPEND_PERMISSION_MANAGER = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad'
/** This repo's SpendPermissionMarginFunder on Base Sepolia (authorized on the exchange 2026-09-24). */
export const SPEND_PERMISSION_FUNDER = '0x20277169a755C690b98F0894EF57AF835469C9Af'
export const MAX_UINT48 = 2n ** 48n - 1n

const PERMISSION = '(address account,address spender,address token,uint160 allowance,uint48 period,uint48 start,uint48 end,uint256 salt,bytes extraData)'
const SPM = new ethers.Interface([`function approve(${PERMISSION} spendPermission) returns (bool)`])
const FUNDER = new ethers.Interface(['function setTopUpAgent(address agent)'])
const SESSIONS = new ethers.Interface([
  'function createSessionWithAssets(address agent,uint256 maxMarginPerTrade,uint256 totalMarginBudget,uint256 maxLeverage,uint256 expiry,bytes32[] allowedAssets) returns (uint256)',
])
const WALLET = new ethers.Interface(['function addOwnerAddress(address owner)'])

export interface SetupParams {
  account: string
  agent: string
  sessionManager: string
  token: string
  /** Margin token base units that may leave the account per period. */
  allowance: bigint
  period: number
  start: number
  end: number
  salt: bigint
  perTrade: bigint
  budget: bigint
  maxLeverage: number
  expiry: number
  assets: readonly string[]
  /** The account does not list SpendPermissionManager as an owner yet: add it first, in the same batch. */
  addSpmOwner?: boolean
}

export interface Call { to: string; value: bigint; data: string }

/** The Spend Permission as JSON (big numbers as decimal strings), the shape the agent's top_up_margin takes. */
export function permissionJsonOf(p: SetupParams) {
  return {
    account: ethers.getAddress(p.account),
    spender: SPEND_PERMISSION_FUNDER,
    token: ethers.getAddress(p.token),
    allowance: p.allowance.toString(),
    period: p.period,
    start: p.start,
    end: p.end,
    salt: p.salt.toString(),
    extraData: '0x',
  }
}

/**
 * Make SpendPermissionManager an owner of the account, which `spend` needs. Coinbase Smart Wallet's
 * onlyOwner accepts calls from the wallet itself. Reverts (AlreadyOwner) if it is one already.
 */
export function addSpmOwnerCall(account: string): Call {
  return { to: ethers.getAddress(account), value: 0n, data: WALLET.encodeFunctionData('addOwnerAddress', [SPEND_PERMISSION_MANAGER]) }
}

export function buildSetupCalls(p: SetupParams): Call[] {
  if (p.allowance <= 0n) throw new Error('allowance must be positive')
  if (p.expiry <= p.start) throw new Error('expiry must be after the start')
  if (p.assets.length === 0) throw new Error('at least one asset must be allowed')

  const perm = permissionJsonOf(p)
  const tuple = [perm.account, perm.spender, perm.token, p.allowance, p.period, p.start, p.end, p.salt, perm.extraData]
  const calls: Call[] = [
    { to: SPEND_PERMISSION_MANAGER, value: 0n, data: SPM.encodeFunctionData('approve', [tuple]) },
    { to: SPEND_PERMISSION_FUNDER, value: 0n, data: FUNDER.encodeFunctionData('setTopUpAgent', [ethers.getAddress(p.agent)]) },
    {
      to: ethers.getAddress(p.sessionManager),
      value: 0n,
      data: SESSIONS.encodeFunctionData('createSessionWithAssets', [
        ethers.getAddress(p.agent), p.perTrade, p.budget, p.maxLeverage, p.expiry, [...p.assets],
      ]),
    },
  ]
  if (p.addSpmOwner) calls.unshift(addSpmOwnerCall(perm.account))
  return calls
}
