// Base Account + Base Spend Permission setup in one EIP-5792 batch (see src/lib/pepefi/baseAccountSetup.ts).
// The batch is the same one that ran on Base Sepolia on 2026-09-24 (demo/SPEND_PERMISSIONS_RUN.md);
// a test pins the encoding to that transaction.
import { useEffect, useState } from 'react'
import { ethers, isAddress, parseUnits, formatUnits } from 'ethers'

import Card from '@mui/material/Card'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { t, interpolate } from 'src/locales'
import { usePepefiWallet } from 'src/layouts/pepefi'
import { explorerTx } from 'src/lib/pepefi/notify'
import { MONO } from 'src/components/pepefi/brandKit'
import { getSessionManagerAddress } from 'src/contracts/sessionManager'
import { ASSET_IDS, getAddresses } from 'src/contracts/addresses'
import { MAX_UINT48, SPEND_PERMISSION_MANAGER, addSpmOwnerCall, buildSetupCalls, permissionJsonOf } from 'src/lib/pepefi/baseAccountSetup'
import { isUserRejection, sendCallsAndWait, supportsAtomicBatch, walletError, type SendOutcome } from 'src/lib/pepefi/walletCalls'

const BASE_SEPOLIA = 84532
const RECORDED_RUN = 'https://github.com/zuemen/pepelab-colosseum/blob/hackathon/colosseum-worldsfair/demo/SPEND_PERMISSIONS_RUN.md'
const WALLET = new ethers.Interface(['function isOwnerAddress(address account) view returns (bool)'])
const ERC20 = new ethers.Interface(['function balanceOf(address) view returns (uint256)'])

/** What the connected account can do. */
type AccountKind = 'checking' | 'smart' | 'smartAddOwner' | 'undeployed' | 'notSmart' | 'notCoinbase' | 'readFailed'

type Result = { severity: 'success' | 'error' | 'info'; text: string; txHash?: string }

interface Props {
  agent: string
  perTrade: string
  budget: string
  maxLeverage: string
  hours: string
  /** Called after the batch confirms, to refresh the session list. */
  onDone: () => void
}

/** Does the deployed account list SpendPermissionManager as an owner? Throws if it is not a Coinbase Smart Wallet. */
async function spmIsOwner(provider: ethers.Provider, account: string): Promise<boolean> {
  const raw = await provider.call({ to: account, data: WALLET.encodeFunctionData('isOwnerAddress', [SPEND_PERMISSION_MANAGER]) })
  return WALLET.decodeFunctionResult('isOwnerAddress', raw)[0] as boolean
}

/** The wallet's receipt can arrive before the node we read from has the block: give `check` a few seconds. */
async function settle(check: () => Promise<boolean>) {
  for (let i = 0; i < 5; i++) {
    try {
      if (await check()) return
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, 2_000))
  }
}

function outcomeResult(out: Exclude<SendOutcome, { kind: 'confirmed' }>, timeoutText: string): Result {
  if (out.kind === 'unsupported') return { severity: 'error', text: t.sessions.baseAccount.unsupported }
  if (out.kind === 'timeout') return { severity: 'info', text: timeoutText }
  return { severity: 'error', text: interpolate(t.sessions.baseAccount.failed, { reason: out.reason }), txHash: out.txHash }
}

function errorResult(e: unknown): Result {
  if (isUserRejection(e)) return { severity: 'info', text: t.sessions.baseAccount.rejected }
  return { severity: 'error', text: interpolate(t.sessions.baseAccount.failed, { reason: walletError(e).message ?? String(e) }) }
}

function ResultAlert({ result }: { result: Result }) {
  const txUrl = result.txHash ? explorerTx(result.txHash, BASE_SEPOLIA) : null
  return (
    <Alert severity={result.severity}>
      {result.text}
      {txUrl && (
        <>
          {' '}
          <Link href={txUrl} target="_blank" rel="noopener" color="inherit" sx={{ textDecoration: 'underline' }}>
            {result.txHash!.slice(0, 10)}… ↗
          </Link>
        </>
      )}
    </Alert>
  )
}

export default function BaseAccountSetupCard({ agent, perTrade, budget, maxLeverage, hours, onDone }: Props) {
  const wallet = usePepefiWallet()
  const [allowance, setAllowance] = useState('100')
  // The last read of the account, tagged with the address it belongs to. A re-read keeps showing it
  // (no "Checking…" flash, the button stays usable); only a new address starts from "checking".
  const [account, setAccount] = useState<{ address: string; kind: AccountKind; balance: bigint | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [permission, setPermission] = useState<string | null>(null)
  const [fixResult, setFixResult] = useState<Result | null>(null)
  // Bumped after every send (and by Retry) so the account status and balance are read again.
  const [recheck, setRecheck] = useState(0)

  const onBaseSepolia = wallet.chainId === BASE_SEPOLIA
  const current = account && account.address === wallet.address ? account : null
  const kind: AccountKind = current?.kind ?? 'checking'
  const balance = current?.balance ?? null

  // Classify the connected account: deployed Coinbase Smart Wallet (with or without
  // SpendPermissionManager as owner), a wallet that will deploy one, or neither.
  useEffect(() => {
    const provider = wallet.provider
    const address = wallet.address
    if (!provider || !address || !onBaseSepolia) return undefined
    let alive = true
    ;(async () => {
      let next: AccountKind
      let code: string
      try {
        code = await provider.getCode(address)
      } catch {
        // A failed re-read keeps the last status; only a failed first read shows readFailed (with Retry).
        if (alive) setAccount((a) => (a?.address === address && a.kind !== 'readFailed' ? a : { address, kind: 'readFailed', balance: null }))
        return
      }
      if (code !== '0x') {
        try {
          next = (await spmIsOwner(provider, address)) ? 'smart' : 'smartAddOwner'
        } catch {
          next = 'notCoinbase'
        }
      } else {
        let caps: unknown = null
        try {
          caps = await provider.send('wallet_getCapabilities', [address, [`0x${BASE_SEPOLIA.toString(16)}`]])
        } catch {
          caps = null
        }
        next = supportsAtomicBatch(caps, BASE_SEPOLIA) ? 'undeployed' : 'notSmart'
      }
      let bal: bigint | null = null
      try {
        const raw = await provider.call({ to: getAddresses(BASE_SEPOLIA)!.MockUSDC, data: ERC20.encodeFunctionData('balanceOf', [address]) })
        bal = ERC20.decodeFunctionResult('balanceOf', raw)[0] as bigint
      } catch {
        bal = null
      }
      if (alive) setAccount((a) => ({ address, kind: next, balance: bal ?? (a?.address === address ? a.balance : null) }))
    })()
    return () => {
      alive = false
    }
  }, [wallet.provider, wallet.address, onBaseSepolia, recheck])

  const usable = kind === 'smart' || kind === 'smartAddOwner' || kind === 'undeployed'
  const agentOk = isAddress(agent)
  // After a confirmed batch from an account that did not exist yet: the wallet created it without
  // SpendPermissionManager as an owner, so the agent's spend would revert until it is added.
  const needsOwnerFix = permission !== null && kind === 'smartAddOwner'

  const setUp = async () => {
    const provider = wallet.provider
    const address = wallet.address
    if (!provider || !address) return
    setResult(null)
    setPermission(null)
    setFixResult(null)
    // The session must outlive the block it lands in (expiry > now + 60 s); checked before any wallet or RPC call.
    const seconds = Math.round(parseFloat(hours) * 3600)
    if (!(seconds > 60)) {
      setResult({ severity: 'error', text: t.sessions.baseAccount.badHours })
      return
    }
    setBusy(true)
    try {
      const latest = await provider.getBlock('latest')
      const now = latest?.timestamp ?? Math.floor(Date.now() / 1000)
      // Read the owner list again right before sending: a batch that landed after an earlier
      // timeout may already have added SpendPermissionManager, and adding it twice reverts.
      // An account that does not exist yet never gets addOwnerAddress in its batch: if the wallet's
      // initCode already lists SpendPermissionManager, AlreadyOwner would revert the whole batch.
      // The remedy button below covers a wallet that creates the account without it.
      const deployed = (await provider.getCode(address)) !== '0x'
      const addSpmOwner = deployed && !(await spmIsOwner(provider, address))
      const params = {
        account: address,
        agent,
        sessionManager: getSessionManagerAddress(BASE_SEPOLIA),
        token: getAddresses(BASE_SEPOLIA)!.MockUSDC,
        allowance: parseUnits(allowance || '0', 18),
        period: 86_400,
        start: now - 60,
        end: Number(MAX_UINT48),
        salt: BigInt(ethers.hexlify(ethers.randomBytes(8))),
        perTrade: parseUnits(perTrade || '0', 18),
        budget: parseUnits(budget || '0', 18),
        maxLeverage: Number(maxLeverage),
        expiry: now + seconds,
        assets: [ASSET_IDS.sBTC, ASSET_IDS.sETH],
        addSpmOwner,
      }
      const out = await sendCallsAndWait(provider, buildSetupCalls(params), address, BASE_SEPOLIA)
      if (out.kind !== 'confirmed') {
        setResult(outcomeResult(out, t.sessions.baseAccount.timeout))
        return
      }
      setPermission(JSON.stringify(permissionJsonOf(params), null, 2))
      setResult({ severity: 'success', text: t.sessions.baseAccount.done, txHash: out.txHash })
      onDone()
      if (!deployed) await settle(async () => (await provider.getCode(address)) !== '0x')
      else if (addSpmOwner) await settle(() => spmIsOwner(provider, address))
    } catch (e) {
      setResult(errorResult(e))
    } finally {
      setBusy(false)
      // Read the account again whatever happened (the batch may still land after a timeout).
      setRecheck((n) => n + 1)
    }
  }

  // One call from the account to itself; no new session, no new Spend Permission.
  const addOwner = async () => {
    const provider = wallet.provider
    const address = wallet.address
    if (!provider || !address) return
    setBusy(true)
    setFixResult(null)
    try {
      // An earlier attempt may have landed late; adding it twice reverts (AlreadyOwner).
      if (await spmIsOwner(provider, address)) {
        setFixResult({ severity: 'success', text: t.sessions.baseAccount.fixDone })
        return
      }
      const out = await sendCallsAndWait(provider, [addSpmOwnerCall(address)], address, BASE_SEPOLIA)
      if (out.kind !== 'confirmed') {
        setFixResult(outcomeResult(out, t.sessions.baseAccount.fixTimeout))
        return
      }
      setFixResult({ severity: 'success', text: t.sessions.baseAccount.fixDone, txHash: out.txHash })
      await settle(() => spmIsOwner(provider, address))
    } catch (e) {
      setFixResult(errorResult(e))
    } finally {
      setBusy(false)
      setRecheck((n) => n + 1)
    }
  }

  const statusText = !onBaseSepolia ? t.sessions.baseAccount.wrongChain : t.sessions.baseAccount[kind]

  return (
    <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.sessions.baseAccount.title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t.sessions.baseAccount.intro}{' '}
        <Link href={RECORDED_RUN} target="_blank" rel="noopener">{t.sessions.baseAccount.recordedRun} ↗</Link>
      </Typography>

      <Alert
        severity={onBaseSepolia && usable ? 'info' : 'warning'}
        action={onBaseSepolia && kind === 'readFailed'
          ? <Button color="inherit" size="small" onClick={() => setRecheck((n) => n + 1)}>{t.sessions.baseAccount.retry}</Button>
          : undefined}
      >
        {statusText}
      </Alert>
      {onBaseSepolia && usable && balance !== null && (
        <Typography variant="caption" color="text.secondary">
          {interpolate(t.sessions.baseAccount.balance, { amount: Number(formatUnits(balance, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 }) })}
        </Typography>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <TextField
          size="small"
          label={t.sessions.baseAccount.dailyAllowance}
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
          type="number"
          sx={{ maxWidth: 220 }}
        />
        <Button variant="contained" disabled={busy || !onBaseSepolia || !usable || !agentOk} onClick={() => void setUp()}>
          {busy ? t.sessions.baseAccount.sending : t.sessions.baseAccount.cta}
        </Button>
      </Stack>
      {!agentOk && <Typography variant="caption" color="text.secondary">{t.sessions.baseAccount.needAgent}</Typography>}

      {result && <ResultAlert result={result} />}

      {needsOwnerFix && (
        <Alert severity="warning">
          <Stack spacing={1} alignItems="flex-start">
            <span>{t.sessions.baseAccount.noSpmOwner}</span>
            <Button size="small" variant="outlined" color="inherit" disabled={busy || !onBaseSepolia} onClick={() => void addOwner()}>
              {busy ? t.sessions.baseAccount.sending : t.sessions.baseAccount.addOwnerCta}
            </Button>
          </Stack>
        </Alert>
      )}
      {fixResult && <ResultAlert result={fixResult} />}

      {permission && (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">{t.sessions.baseAccount.permissionLabel}</Typography>
            <Button size="small" onClick={() => void navigator.clipboard?.writeText(permission)}>{t.sessions.baseAccount.copy}</Button>
          </Stack>
          <Typography component="pre" sx={{ fontFamily: MONO, fontSize: 12, m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, overflowX: 'auto' }}>
            {permission}
          </Typography>
        </Stack>
      )}
    </Card>
  )
}
