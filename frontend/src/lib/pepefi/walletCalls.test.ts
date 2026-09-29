import { BrowserProvider } from 'ethers'
import { describe, it, expect } from 'vitest'

import {
  sendCallsParams, parseCallsStatus, isUnsupportedMethod, isUserRejection, isVersionMismatch, walletError, supportsAtomicBatch,
  sendCallsAndWait,
} from './walletCalls'

const FROM = '0x56D83fEe6cf6F0BFf345640C7527a1869677435F'
const calls = [
  { to: '0xf85210B21cC50302F477BA56686d2019dC9b67Ad', value: 0n, data: '0x1234' },
  { to: '0x20277169a755C690b98F0894EF57AF835469C9Af', value: 5n, data: '0xabcd' },
]

describe('sendCallsParams', () => {
  it('EIP-5792 2.0.0：鏈 id 與 value 用 hex，要求原子執行', () => {
    expect(sendCallsParams(calls, FROM, 84532)).toEqual([
      {
        version: '2.0.0',
        chainId: '0x14a34',
        from: FROM,
        atomicRequired: true,
        calls: [
          { to: calls[0].to, data: '0x1234', value: '0x0' },
          { to: calls[1].to, data: '0xabcd', value: '0x5' },
        ],
      },
    ])
  })

  it('1.0 格式（較舊的錢包）', () => {
    const p = sendCallsParams(calls, FROM, 84532, '1.0')[0] as Record<string, unknown>
    expect(p.version).toBe('1.0')
    expect(p).not.toHaveProperty('atomicRequired')
  })
})

describe('parseCallsStatus', () => {
  const receipt = { status: '0x1', transactionHash: '0xaaa' }
  it('2.0.0：200 = 已確認，取第一筆收據的 hash', () => {
    expect(parseCallsStatus({ status: 200, receipts: [receipt] })).toEqual({ state: 'confirmed', txHash: '0xaaa' })
  })
  it('2.0.0：100 = 處理中；400／500／600 = 失敗', () => {
    expect(parseCallsStatus({ status: 100 }).state).toBe('pending')
    expect(parseCallsStatus({ status: 400 }).state).toBe('failed')
    expect(parseCallsStatus({ status: 500, receipts: [{ status: '0x0', transactionHash: '0xbbb' }] })).toEqual({ state: 'failed', txHash: '0xbbb' })
    expect(parseCallsStatus({ status: 600 }).state).toBe('failed')
  })
  it('1.0：PENDING／CONFIRMED 字串；收據 status 0x0 視為失敗', () => {
    expect(parseCallsStatus({ status: 'PENDING' }).state).toBe('pending')
    expect(parseCallsStatus({ status: 'CONFIRMED', receipts: [receipt] })).toEqual({ state: 'confirmed', txHash: '0xaaa' })
    expect(parseCallsStatus({ status: 'CONFIRMED', receipts: [{ status: '0x0', transactionHash: '0xccc' }] })).toEqual({ state: 'failed', txHash: '0xccc' })
  })
  it('看不懂的回應 → pending（繼續輪詢，由呼叫端的逾時收尾）', () => {
    expect(parseCallsStatus(null).state).toBe('pending')
    expect(parseCallsStatus({}).state).toBe('pending')
  })
})

describe('isUnsupportedMethod', () => {
  it('EIP-1193 4200、JSON-RPC -32601 與常見訊息都算「錢包不支援」', () => {
    expect(isUnsupportedMethod({ code: 4200 })).toBe(true)
    expect(isUnsupportedMethod({ error: { code: -32601 } })).toBe(true)
    expect(isUnsupportedMethod(new Error('the method wallet_sendCalls does not exist / is not available'))).toBe(true)
    expect(isUnsupportedMethod({ code: 4001, message: 'User rejected the request' })).toBe(false)
  })
})

describe('supportsAtomicBatch', () => {
  it('2.0.0：只有 supported 算；ready（要先用 EIP-7702 升級帳戶）不算', () => {
    expect(supportsAtomicBatch({ '0x14a34': { atomic: { status: 'supported' } } }, 84532)).toBe(true)
    expect(supportsAtomicBatch({ '0x14a34': { atomic: { status: 'ready' } } }, 84532)).toBe(false)
    expect(supportsAtomicBatch({ '0x14a34': { atomic: { status: 'unsupported' } } }, 84532)).toBe(false)
  })
  it('1.0：atomicBatch.supported', () => {
    expect(supportsAtomicBatch({ '0x14a34': { atomicBatch: { supported: true } } }, 84532)).toBe(true)
  })
  it('別條鏈或沒有回應 → false', () => {
    expect(supportsAtomicBatch({ '0x1': { atomic: { status: 'supported' } } }, 84532)).toBe(false)
    expect(supportsAtomicBatch(null, 84532)).toBe(false)
  })
})

/** An EIP-1193 wallet on Base Sepolia whose wallet_sendCalls fails with `error`, seen through ethers like the card sees it. */
async function sendCallsError(error: { code: number; message: string }): Promise<unknown> {
  const provider = new BrowserProvider({
    request: async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x14a34'
      throw error
    },
  })
  try {
    await provider.send('wallet_sendCalls', sendCallsParams(calls, FROM, 84532))
  } catch (e) {
    return e
  }
  throw new Error('expected wallet_sendCalls to fail')
}

describe('錢包錯誤經過 ethers 包裝後（卡片實際拿到的形狀）', () => {
  it('使用者拒絕（4001）：是拒絕，不是版本問題，不會再跳第二次錢包', async () => {
    const e = await sendCallsError({ code: 4001, message: 'User rejected the request.' })
    expect((e as Error).message).toMatch(/version=/) // ethers 的包裝訊息一定帶 version=，不能拿它比對
    expect(isUserRejection(e)).toBe(true)
    expect(isVersionMismatch(e)).toBe(false)
    expect(isUnsupportedMethod(e)).toBe(false)
  })
  it('錢包不認得 2.0.0 → 版本問題（改用 1.0 重送）', async () => {
    const e = await sendCallsError({ code: -32602, message: 'Unsupported wallet_sendCalls version: 2.0.0' })
    expect(isVersionMismatch(e)).toBe(true)
    expect(isUserRejection(e)).toBe(false)
  })
  it('錢包沒有這個方法 → 不支援', async () => {
    expect(isUnsupportedMethod(await sendCallsError({ code: 4200, message: 'The requested method is not supported' }))).toBe(true)
    expect(isUnsupportedMethod(await sendCallsError({ code: -32601, message: 'the method wallet_sendCalls does not exist/is not available' }))).toBe(true)
  })
  it('其他錯誤：三者皆否，walletError 取回錢包原本的訊息', async () => {
    const e = await sendCallsError({ code: -32603, message: 'Internal error' })
    expect([isUserRejection(e), isVersionMismatch(e), isUnsupportedMethod(e)]).toEqual([false, false, false])
    expect(walletError(e)).toEqual({ code: -32603, message: 'Internal error' })
  })
})

describe('isVersionMismatch 只認「錢包不接受 2.0.0」，其他錯誤不會用 1.0 重送（重送＝第二次錢包彈窗）', () => {
  it('-32602 且訊息提到 wallet_sendCalls／2.0.0／version → 是', async () => {
    expect(isVersionMismatch(await sendCallsError({ code: -32602, message: 'Unsupported wallet_sendCalls version: 2.0.0' }))).toBe(true)
    expect(isVersionMismatch(await sendCallsError({ code: -32602, message: 'invalid params: expected version "1.0"' }))).toBe(true)
  })
  it('內部錯誤剛好提到 version → 否', async () => {
    expect(isVersionMismatch(await sendCallsError({ code: -32603, message: 'Internal error: unsupported version of the account' }))).toBe(false)
  })
  it('-32602 但沒提到版本 → 否', async () => {
    expect(isVersionMismatch(await sendCallsError({ code: -32602, message: 'Invalid params: calls[0].to is not an address' }))).toBe(false)
  })
  it('SDK 自己的 TypeError（沒有錢包錯誤碼）→ 否', () => {
    expect(isVersionMismatch(new TypeError("Cannot read properties of undefined (reading 'version')"))).toBe(false)
  })
})

describe('isUnsupportedMethod 不把 ethers 自己的 UNSUPPORTED_OPERATION 當成錢包不支援', () => {
  it('provider 已 destroy（"provider destroyed; cancelled request"）→ 否', async () => {
    const provider = new BrowserProvider({ request: async () => '0x14a34' })
    provider.destroy()
    const e = await provider.send('wallet_sendCalls', sendCallsParams(calls, FROM, 84532)).then(
      () => { throw new Error('expected a rejection') },
      (err: unknown) => err,
    )
    expect((e as { code?: string }).code).toBe('UNSUPPORTED_OPERATION')
    expect(isUnsupportedMethod(e)).toBe(false)
  })
  it('錢包說「the method … does not exist」（ethers 也包成 UNSUPPORTED_OPERATION，但帶 info.error）→ 是', async () => {
    const e = await sendCallsError({ code: -32601, message: 'the method wallet_sendCalls does not exist/is not available' })
    expect((e as { code?: string }).code).toBe('UNSUPPORTED_OPERATION')
    expect(isUnsupportedMethod(e)).toBe(true)
  })
})

/** A mock EIP-1193 wallet seen through ethers; `sent` records every wallet_sendCalls version it received. */
function mockWallet(onSend: (version: string) => unknown, statuses: unknown[]) {
  const sent: string[] = []
  let polls = 0
  const provider = new BrowserProvider({
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_chainId') return '0x14a34'
      if (method === 'wallet_sendCalls') {
        const version = (params?.[0] as { version: string }).version
        sent.push(version)
        return onSend(version)
      }
      if (method === 'wallet_getCallsStatus') return statuses[Math.min(polls++, statuses.length - 1)]
      throw new Error(`unexpected ${method}`)
    },
  })
  return { provider, sent }
}
const noSleep = { sleep: async () => {} }
const confirmed = { status: 200, receipts: [{ status: '0x1', transactionHash: '0xaaa' }] }

describe('sendCallsAndWait（兩顆按鈕共用的送出＋輪詢）', () => {
  it('2.0.0 送出、輪詢到 200 → confirmed，帶 tx hash', async () => {
    const { provider, sent } = mockWallet(() => ({ id: 'b1' }), [{ status: 100 }, confirmed])
    expect(await sendCallsAndWait(provider, calls, FROM, 84532, noSleep)).toEqual({ kind: 'confirmed', txHash: '0xaaa' })
    expect(sent).toEqual(['2.0.0'])
  })
  it('錢包不接受 2.0.0 → 改用 1.0 重送一次（1.0 的回應是字串 id）', async () => {
    const { provider, sent } = mockWallet((v) => {
      if (v === '2.0.0') throw { code: -32602, message: 'Unsupported wallet_sendCalls version: 2.0.0' }
      return 'b2'
    }, [{ status: 'CONFIRMED', receipts: [{ status: '0x1', transactionHash: '0xbbb' }] }])
    expect(await sendCallsAndWait(provider, calls, FROM, 84532, noSleep)).toEqual({ kind: 'confirmed', txHash: '0xbbb' })
    expect(sent).toEqual(['2.0.0', '1.0'])
  })
  it('使用者拒絕 → 丟出錯誤、只問一次錢包', async () => {
    const { provider, sent } = mockWallet(() => { throw { code: 4001, message: 'User rejected the request.' } }, [])
    const e = await sendCallsAndWait(provider, calls, FROM, 84532, noSleep).catch((err: unknown) => err)
    expect(isUserRejection(e)).toBe(true)
    expect(sent).toEqual(['2.0.0'])
  })
  it('內部錯誤（訊息提到 version）→ 丟出錯誤、不重送', async () => {
    const { provider, sent } = mockWallet(() => { throw { code: -32603, message: 'Internal error: bad version' } }, [])
    await expect(sendCallsAndWait(provider, calls, FROM, 84532, noSleep)).rejects.toBeDefined()
    expect(sent).toEqual(['2.0.0'])
  })
  it('錢包沒有 wallet_sendCalls → unsupported', async () => {
    const { provider } = mockWallet(() => { throw { code: 4200, message: 'The requested method is not supported' } }, [])
    expect(await sendCallsAndWait(provider, calls, FROM, 84532, noSleep)).toEqual({ kind: 'unsupported' })
  })
  it('鏈上回退 → failed／reverted；沒上鏈 → failed，帶錢包狀態碼', async () => {
    const reverted = mockWallet(() => ({ id: 'b3' }), [{ status: 500, receipts: [{ status: '0x0', transactionHash: '0xccc' }] }])
    expect(await sendCallsAndWait(reverted.provider, calls, FROM, 84532, noSleep)).toEqual({ kind: 'failed', txHash: '0xccc', reason: 'reverted' })
    const dropped = mockWallet(() => ({ id: 'b4' }), [{ status: 400 }])
    expect(await sendCallsAndWait(dropped.provider, calls, FROM, 84532, noSleep)).toEqual({ kind: 'failed', reason: 'wallet status 400' })
  })
  it('一直 pending → 逾時（輪詢次數 = timeoutMs / intervalMs）', async () => {
    const { provider } = mockWallet(() => ({ id: 'b5' }), [{ status: 100 }])
    let sleeps = 0
    const out = await sendCallsAndWait(provider, calls, FROM, 84532, { timeoutMs: 10_000, intervalMs: 2_000, sleep: async () => { sleeps++ } })
    expect(out).toEqual({ kind: 'timeout' })
    expect(sleeps).toBe(5)
  })
})
