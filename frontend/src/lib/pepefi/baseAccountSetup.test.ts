import { describe, it, expect } from 'vitest'
import { ethers } from 'ethers'

import { ASSET_IDS } from 'src/contracts/addresses'

import recorded from './__fixtures__/baseAccountSetupBatch.json'
import {
  MAX_UINT48,
  SPEND_PERMISSION_FUNDER,
  SPEND_PERMISSION_MANAGER,
  addSpmOwnerCall,
  buildSetupCalls,
  permissionJsonOf,
  readSpmOwner,
  type SetupParams,
} from './baseAccountSetup'

const AGENT = '0xd3c6a11ef5aF3D197Ecd0C9C44B15a23138d0EB7'
const SESSION_MANAGER = '0x71125e25c903AD4e198e1863d5Bf26df97926CDe'
const MOCK_USDC = '0x0910e965B06845BD3871860d522952a44a574058'

/** The parameters of the batch that succeeded on Base Sepolia on 2026-09-24. */
const params: SetupParams = {
  account: recorded.account,
  agent: AGENT,
  sessionManager: SESSION_MANAGER,
  token: MOCK_USDC,
  allowance: ethers.parseUnits('100', 18),
  period: 86_400,
  start: recorded.varying.start,
  end: Number(MAX_UINT48),
  salt: BigInt(recorded.varying.salt),
  perTrade: ethers.parseUnits('50', 18),
  budget: ethers.parseUnits('150', 18),
  maxLeverage: 3,
  expiry: recorded.varying.expiry,
  assets: [ASSET_IDS.sBTC, ASSET_IDS.sETH],
}

describe('buildSetupCalls', () => {
  it('產生的三個呼叫與 9/24 在鏈上成功的那筆批次逐位元一致', () => {
    const calls = buildSetupCalls(params)
    expect(calls.map((c) => [c.to.toLowerCase(), c.value, c.data.toLowerCase()])).toEqual(
      recorded.calls.map((c) => [c.target.toLowerCase(), BigInt(c.value), c.data.toLowerCase()]),
    )
  })

  it('順序是：核准 Spend Permission → 指定 top-up agent → 開 session', () => {
    const [a, b, c] = buildSetupCalls(params)
    expect(a.to).toBe(SPEND_PERMISSION_MANAGER)
    expect(b.to).toBe(SPEND_PERMISSION_FUNDER)
    expect(c.to).toBe(ethers.getAddress(SESSION_MANAGER))
  })

  it('SpendPermissionManager 還不是 owner 時，先讓帳戶把它加為 owner', () => {
    const calls = buildSetupCalls({ ...params, addSpmOwner: true })
    expect(calls).toHaveLength(4)
    expect(calls[0].to).toBe(ethers.getAddress(recorded.account))
    const iface = new ethers.Interface(['function addOwnerAddress(address owner)'])
    expect(iface.decodeFunctionData('addOwnerAddress', calls[0].data)[0]).toBe(SPEND_PERMISSION_MANAGER)
    expect(calls.slice(1).map((c) => c.data)).toEqual(buildSetupCalls(params).map((c) => c.data))
  })

  it('拒絕明顯錯誤的參數', () => {
    expect(() => buildSetupCalls({ ...params, allowance: 0n })).toThrow(/allowance/)
    expect(() => buildSetupCalls({ ...params, expiry: params.start })).toThrow(/expiry/)
    expect(() => buildSetupCalls({ ...params, assets: [] })).toThrow(/asset/)
  })
})

describe('addSpmOwnerCall', () => {
  it('補救按鈕送的單一呼叫：帳戶自己呼叫 addOwnerAddress(SPM)，與批次裡加 owner 的那一筆相同', () => {
    const call = addSpmOwnerCall(recorded.account.toLowerCase())
    expect(call).toEqual(buildSetupCalls({ ...params, addSpmOwner: true })[0])
    expect(call.to).toBe(ethers.getAddress(recorded.account))
    expect(call.value).toBe(0n)
  })
})

describe('permissionJsonOf', () => {
  it('給 agent 用的 Spend Permission JSON 與批次核准的內容一致', () => {
    const p = permissionJsonOf(params)
    expect(p.account).toBe(ethers.getAddress(recorded.account))
    expect(p.spender).toBe(SPEND_PERMISSION_FUNDER)
    expect(p.token).toBe(ethers.getAddress(MOCK_USDC))
    expect(p.allowance).toBe(ethers.parseUnits('100', 18).toString())
    expect([p.period, p.start, p.end, p.salt, p.extraData]).toEqual([86_400, recorded.varying.start, Number(MAX_UINT48), recorded.varying.salt, '0x'])
  })
})

describe('readSpmOwner（批次建立帳戶之後，SpendPermissionManager 是不是 owner）', () => {
  const TRUE = ethers.AbiCoder.defaultAbiCoder().encode(['bool'], [true])
  const FALSE = ethers.AbiCoder.defaultAbiCoder().encode(['bool'], [false])
  /** A reader that answers from the lists in order (the last answer repeats); `Error` entries throw. */
  function reader(codes: (string | Error)[], calls: (string | Error)[]) {
    let c = 0
    let k = 0
    const next = (list: (string | Error)[], i: number) => {
      const v = list[Math.min(i, list.length - 1)]
      if (v instanceof Error) throw v
      return v
    }
    return {
      getCode: async () => next(codes, c++),
      call: async () => next(calls, k++),
    }
  }
  const counting = () => {
    const s = { n: 0, sleep: async () => { s.n++ } }
    return s
  }

  it('已部署且是 owner → yes，不等待', async () => {
    const s = counting()
    expect(await readSpmOwner(reader(['0x60'], [TRUE]), recorded.account, s)).toBe('yes')
    expect(s.n).toBe(0)
  })
  it('讀取節點還沒看到帳戶（code 0x）→ 等一下再讀；看到後不是 owner → no', async () => {
    const s = counting()
    expect(await readSpmOwner(reader(['0x', '0x', '0x60'], [FALSE]), recorded.account, s)).toBe('no')
    expect(s.n).toBe(2)
  })
  it('新帳戶的 eth_call 回空值（落後的節點）或讀取失敗 → 重試，不直接下結論', async () => {
    expect(await readSpmOwner(reader(['0x60'], ['0x', new Error('network'), TRUE]), recorded.account, counting())).toBe('yes')
  })
  it('一直讀不到 → unknown（試 5 次、等 4 次）', async () => {
    const s = counting()
    expect(await readSpmOwner(reader([new Error('network')], [TRUE]), recorded.account, s)).toBe('unknown')
    expect(s.n).toBe(4)
  })
})
