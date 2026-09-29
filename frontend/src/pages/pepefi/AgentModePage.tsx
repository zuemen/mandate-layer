// Agent Mode（/agent-mode）——給評審的一頁：不連錢包、不依賴 signal-api 或任何後端，
// 三分鐘內看懂 agent 付了什麼錢、被授權到多少、哪些下單被合約拒絕。
//
// 資料來源全部是鏈：
//   - x402 付費：Circle USDC 轉給訊號賣方的 Transfer 事件
//   - session 上限：AgentSessionManager.sessions(i)
//   - agent 動作：SessionOpenedPosition / SessionClosedPosition / SessionRevoked 事件
//   - 現場測試：eth_call 以 session agent 的身分模擬超額下單——eth_call 可以指定任意
//     from，所以評審不需要私鑰，回傳的就是合約本身的 revert
// 唯一不是即時讀鏈的是「被拒絕的交易」：revert 不產生事件，日誌裡掃不到，所以顯示
// agent/examples/e2e-demo.ts 最近一次執行寫出的 demoRun.json（每步附 BaseScan 連結）。
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import { Link as RouterLink } from 'react-router'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TableRow from '@mui/material/TableRow'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import TableContainer from '@mui/material/TableContainer'
import CircularProgress from '@mui/material/CircularProgress'

import { t, interpolate } from 'src/locales'
import { usePepefiWallet } from 'src/layouts/pepefi'
import { getAddresses, ASSET_IDS, PRIMARY_CHAIN_ID } from 'src/contracts/addresses'
import { classifySimulationFailure } from 'src/lib/pepefi/simulationOutcome'
import { plainStep } from 'src/lib/pepefi/recordedRun'
import { CIRCLE_USDC, READ_RPC, TRANSFER_TOPIC, parsePaymentLog, readProvider, scanLogs, type Payment } from 'src/lib/pepefi/x402Payments'
import { getSessionManagerAddress } from 'src/contracts/sessionManager'
import AgentSessionManagerABI from 'src/contracts/abi/AgentSessionManager.json'
import { deployBlock, describeScanWindow } from 'src/lib/pepefi/chainLogs'
import { mapLimit, RPC_CONCURRENCY } from 'src/lib/pepefi/rpcBatch'
import { MONO, PEPE, shortAddr } from 'src/components/pepefi/brandKit'
import demoRun from 'src/lib/pepefi/demoRun.json'

// ----------------------------------------------------------------------

const CHAIN_ID = PRIMARY_CHAIN_ID
const MAX_SESSIONS = 50
const basescanTx = (h: string) => `https://sepolia.basescan.org/tx/${h}`
const basescanAddr = (a: string) => `https://sepolia.basescan.org/address/${a}`

const iface = new ethers.Interface(AgentSessionManagerABI as ethers.InterfaceAbi)
const EVENT_TOPICS = ['SessionOpenedPosition', 'SessionClosedPosition', 'SessionRevoked'].map(
  (n) => iface.getEvent(n)!.topicHash,
)

interface SessionRow {
  id: number; user: string; agent: string; perTrade: number; budget: number; spent: number
  maxLeverage: number; expiry: number; revoked: boolean
}
interface ActivityRow { tx: string; block: number; session: number; text: string }
interface TryResult { kind: 'rejected' | 'accepted' | 'error'; text: string }

const fmt18 = (v: bigint) => Number(ethers.formatUnits(v, 18))
// Written by agent/examples/spend-permission-demo.ts. Loaded through a glob so the build still
// works before that run exists; the section only renders when the file is there.
interface SpendPermissionRun { generatedAt: string; allowance: number; steps: { n: string; actor: string; action: string; tx: string | null; result: string }[] }
const spendPermissionRun: SpendPermissionRun | null =
  Object.values(import.meta.glob<{ default: SpendPermissionRun }>('../../lib/pepefi/spendPermissionRun.json', { eager: true }))[0]?.default ?? null
const SYMBOL_BY_ASSET_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ASSET_IDS).map(([sym, id]) => [id.toLowerCase(), sym]),
)

function statusOf(s: SessionRow, now: number): 'active' | 'revoked' | 'expired' {
  if (s.revoked) return 'revoked'
  if (s.expiry <= now) return 'expired'
  return 'active'
}

// ----------------------------------------------------------------------

const cellMono = { fontFamily: MONO, fontSize: 13 }
const txLink = (h: string) => (
  <Link href={basescanTx(h)} target="_blank" rel="noopener" sx={cellMono}>{h.slice(0, 10)}…</Link>
)

export default function AgentModePage() {
  // /sessions is not public: a visitor without a wallet (a judge) would be sent back to /.
  const walletConnected = usePepefiWallet()?.isConnected ?? false
  const provider = useMemo(() => readProvider(READ_RPC, CHAIN_ID), [])
  const addrs = getAddresses(CHAIN_ID)
  const managerAddr = getSessionManagerAddress(CHAIN_ID)
  const seller = demoRun.seller ?? ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [windowBlocks, setWindowBlocks] = useState(0)
  const [payments, setPayments] = useState<Payment[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [tryResult, setTryResult] = useState<Record<string, TryResult>>({})
  const [trying, setTrying] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const current = await provider.getBlockNumber()
      const from = deployBlock(CHAIN_ID) ?? Math.max(0, current - 50_000)
      setWindowBlocks(current - from)

      // x402 payments: Circle USDC → seller
      const payLogs = seller
        ? await scanLogs({
            address: CIRCLE_USDC,
            topics: [TRANSFER_TOPIC, null, ethers.zeroPadValue(seller, 32)],
          }, from, current, CHAIN_ID)
        : []
      setPayments(
        payLogs.map((l) => parsePaymentLog(l)).sort((a, b) => b.block - a.block),
      )

      // Session caps
      const mgr = new ethers.Contract(managerAddr, AgentSessionManagerABI as ethers.InterfaceAbi, provider)
      // The newest MAX_SESSIONS sessions (reading ids 0..49 would hide every session after the 50th).
      const total = Number(await mgr.nextSessionId())
      const first = Math.max(0, total - MAX_SESSIONS)
      const rows = await mapLimit(Array.from({ length: total - first }, (_, i) => first + i), RPC_CONCURRENCY, async (id) => {
        const s = await mgr.sessions(id)
        return {
          id, user: s.user as string, agent: s.agent as string,
          perTrade: fmt18(s.maxMarginPerTrade), budget: fmt18(s.totalMarginBudget), spent: fmt18(s.spentMargin),
          maxLeverage: Number(s.maxLeverage), expiry: Number(s.expiry), revoked: Boolean(s.revoked),
        } satisfies SessionRow
      })
      setSessions(rows.sort((a, b) => b.id - a.id))

      // Agent actions
      const evLogs = await scanLogs({ address: managerAddr, topics: [EVENT_TOPICS] }, from, current, CHAIN_ID)
      setActivity(
        evLogs
          .map((l) => {
            const p = iface.parseLog(l)
            if (!p) return null
            const session = Number(p.args.sessionId)
            const text =
              p.name === 'SessionOpenedPosition'
                ? interpolate(t.agentMode.activity.opened, {
                    position: String(p.args.positionId), margin: fmt18(p.args.margin).toString(),
                  })
                : p.name === 'SessionClosedPosition'
                  ? interpolate(t.agentMode.activity.closed, { position: String(p.args.positionId) })
                  : t.agentMode.activity.revoked
            return { tx: l.transactionHash as string, block: Number(l.blockNumber), session, text }
          })
          .filter((r): r is ActivityRow => r !== null)
          .sort((a, b) => b.block - a.block),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [provider, managerAddr, seller])

  useEffect(() => { void load() }, [load])

  // One failed read leaves every later section empty; saying "No sessions yet" then would
  // tell a judge the chain has nothing, when the page simply could not read it.
  const emptyText = (empty: string) => (loading ? t.agentMode.loading : error ? t.agentMode.unreadable : empty)

  const now = Math.floor(Date.now() / 1000)
  // createSession is open to anyone, so "the newest active session" could be a stranger's
  // (for example one without an asset allow-list). The sandbox is the newest active session
  // opened by the demo's own user.
  const sandbox = sessions.find(
    (s) => statusOf(s, now) === 'active' && s.user.toLowerCase() === (demoRun.user ?? '').toLowerCase(),
  )

  /** Simulate an order from the session's own agent address. Nothing is signed or sent. */
  const tryOrder = useCallback(async (key: string, asset: string, margin: number) => {
    if (!sandbox || !addrs) return
    setTrying(key)
    try {
      const exchange = new ethers.Contract(addrs.PerpetualExchange, ['function executionFee() view returns (uint256)'], provider)
      const fee = (await exchange.executionFee()) as bigint
      const data = iface.encodeFunctionData('openPositionForSession', [
        sandbox.id, asset, true, ethers.parseUnits(String(margin), 18), 2, ethers.ZeroAddress,
      ])
      try {
        await provider.call({ from: sandbox.agent, to: managerAddr, data, value: fee })
        setTryResult((r) => ({ ...r, [key]: { kind: 'accepted', text: t.agentMode.tryIt.accepted } }))
      } catch (e) {
        const outcome = classifySimulationFailure(e, iface)
        const template = outcome.kind === 'rejected' ? t.agentMode.tryIt.rejected : t.agentMode.tryIt.simulationFailed
        // AssetNotAllowed 的參數是 bytes32 資產 ID，換成評審看得懂的代號。
        const reason = (outcome.reason ?? t.agentMode.tryIt.noReason).replace(/0x[0-9a-fA-F]{64}/g, (h) => SYMBOL_BY_ASSET_ID[h.toLowerCase()] ?? h)
        setTryResult((r) => ({ ...r, [key]: { kind: outcome.kind, text: interpolate(template, { reason }) } }))
      }
    } catch (e) {
      setTryResult((r) => ({ ...r, [key]: { kind: 'error', text: (e as Error).message } }))
    } finally {
      setTrying(null)
    }
  }, [sandbox, addrs, provider, managerAddr])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{t.agentMode.title}</Typography>
            <Typography variant="body1" color="text.secondary">{t.agentMode.subtitle}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {windowBlocks > 0 && (
              <Chip size="small" label={interpolate(t.agentMode.scanWindow, { window: describeScanWindow(CHAIN_ID, windowBlocks) })} />
            )}
            <Button variant="outlined" onClick={() => void load()} disabled={loading} sx={{ textTransform: 'none' }}>
              {loading ? <CircularProgress size={18} /> : t.agentMode.refresh}
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error">{interpolate(t.agentMode.readError, { error })}</Alert>}

        {/* How it works */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1.5 }}>{t.agentMode.howTitle}</Typography>
          <Stack spacing={1}>
            {t.agentMode.how.map((line, i) => (
              <Stack key={line} direction="row" spacing={1.5} alignItems="flex-start">
                <Chip size="small" label={i + 1} sx={{ bgcolor: PEPE.green, color: '#000', fontWeight: 'bold' }} />
                <Typography variant="body2">{line}</Typography>
              </Stack>
            ))}
          </Stack>
        </Card>

        {/* Try it */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.agentMode.tryIt.title}</Typography>
          {sandbox ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                {interpolate(t.agentMode.tryIt.caption, {
                  session: String(sandbox.id), margin: String(sandbox.perTrade + 30), cap: String(sandbox.perTrade),
                })}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" disabled={trying !== null}
                  onClick={() => void tryOrder('overCap', ASSET_IDS.sBTC, sandbox.perTrade + 30)}
                  sx={{ textTransform: 'none' }}>
                  {t.agentMode.tryIt.button} · sBTC · {sandbox.perTrade + 30}
                </Button>
                <Button variant="outlined" disabled={trying !== null}
                  onClick={() => void tryOrder('asset', ASSET_IDS.sAAPL, 10)}
                  sx={{ textTransform: 'none' }}>
                  {t.agentMode.tryIt.buttonAsset} · sAAPL · 10
                </Button>
              </Stack>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {Object.entries(tryResult).map(([k, r]) => (
                  <Alert key={k} severity={r.kind === 'rejected' ? 'success' : r.kind === 'accepted' ? 'warning' : 'error'}
                    sx={{ fontFamily: MONO }}>{r.text}</Alert>
                ))}
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{loading ? t.agentMode.loading : error ? t.agentMode.unreadable : t.agentMode.tryIt.noSession}</Typography>
          )}
        </Card>

        {/* Sessions */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.agentMode.sessions.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t.agentMode.sessions.caption}</Typography>
          {sessions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{emptyText(t.agentMode.sessions.empty)}</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t.agentMode.sessions.colId}</TableCell>
                    <TableCell>{t.agentMode.sessions.colAgent}</TableCell>
                    <TableCell align="right">{t.agentMode.sessions.colPerTrade}</TableCell>
                    <TableCell align="right">{t.agentMode.sessions.colBudget}</TableCell>
                    <TableCell align="right">{t.agentMode.sessions.colLeverage}</TableCell>
                    <TableCell>{t.agentMode.sessions.colExpiry}</TableCell>
                    <TableCell>{t.agentMode.sessions.colStatus}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((s) => {
                    const st = statusOf(s, now)
                    return (
                      <TableRow key={s.id}>
                        <TableCell sx={cellMono}>{s.id}</TableCell>
                        <TableCell><Link href={basescanAddr(s.agent)} target="_blank" rel="noopener" sx={cellMono}>{shortAddr(s.agent)}</Link></TableCell>
                        <TableCell align="right" sx={cellMono}>{s.perTrade}</TableCell>
                        <TableCell align="right" sx={cellMono}>{s.spent} / {s.budget}</TableCell>
                        <TableCell align="right" sx={cellMono}>{s.maxLeverage}x</TableCell>
                        <TableCell sx={cellMono}>{new Date(s.expiry * 1000).toISOString().slice(0, 10)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={t.agentMode.sessions[st]}
                            color={st === 'active' ? 'success' : st === 'revoked' ? 'error' : 'default'} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        {/* Payments */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.agentMode.payments.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {interpolate(t.agentMode.payments.caption, { seller: seller ? shortAddr(seller) : '—' })}
          </Typography>
          {payments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{emptyText(t.agentMode.payments.empty)}</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t.agentMode.payments.colFrom}</TableCell>
                    <TableCell align="right">{t.agentMode.payments.colAmount}</TableCell>
                    <TableCell>{t.agentMode.payments.colTx}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.tx}>
                      <TableCell sx={cellMono}>{shortAddr(p.from)}</TableCell>
                      <TableCell align="right" sx={cellMono}>{p.amount} USDC</TableCell>
                      <TableCell>{txLink(p.tx)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>

        {/* Activity */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>{t.agentMode.activity.title}</Typography>
          {activity.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{emptyText(t.agentMode.activity.empty)}</Typography>
          ) : (
            <Stack spacing={1}>
              {activity.map((a) => (
                <Stack key={`${a.tx}-${a.text}`} direction="row" spacing={2} alignItems="center">
                  <Chip size="small" label={`#${a.session}`} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{a.text}</Typography>
                  {txLink(a.tx)}
                </Stack>
              ))}
            </Stack>
          )}
        </Card>

        {/* Base Account + Spend Permission run (shown once spend-permission-demo.ts has written its JSON) */}
        {spendPermissionRun && (
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.agentMode.spendRun.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {interpolate(t.agentMode.spendRun.caption, {
                allowance: String(spendPermissionRun.allowance),
                at: spendPermissionRun.generatedAt.slice(0, 16).replace('T', ' ') + ' UTC',
              })}
            </Typography>
            <RecordedSteps steps={spendPermissionRun.steps} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t.agentMode.spendRun.inApp}{' '}
              {walletConnected
                ? <Link component={RouterLink} to="/sessions">{t.agentMode.spendRun.inAppLink} →</Link>
                : t.agentMode.spendRun.inAppNoWallet}
            </Typography>
          </Card>
        )}

        {/* Recorded run */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.agentMode.recorded.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {interpolate(t.agentMode.recorded.caption, { at: demoRun.generatedAt.slice(0, 16).replace('T', ' ') + ' UTC' })}
          </Typography>
          <RecordedSteps steps={demoRun.steps} />
        </Card>
      </Stack>
    </Container>
  )
}

interface RecordedStep { n: string; actor: string; action: string; tx: string | null; result: string }

/** One recorded run, step by step; reverted steps are highlighted. */
function RecordedSteps({ steps }: { steps: readonly RecordedStep[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t.agentMode.recorded.colStep}</TableCell>
            <TableCell>{t.agentMode.recorded.colActor}</TableCell>
            <TableCell>{t.agentMode.recorded.colAction}</TableCell>
            <TableCell>{t.agentMode.recorded.colResult}</TableCell>
            <TableCell>{t.agentMode.recorded.colTx}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {steps.map((s) => {
            const rejected = s.result.startsWith('reverted')
            return (
              <TableRow key={s.n} sx={rejected ? { bgcolor: 'rgba(255,86,48,0.08)' } : undefined}>
                <TableCell sx={cellMono}>{plainStep(s.n)}</TableCell>
                <TableCell>{s.actor}</TableCell>
                <TableCell sx={{ fontSize: 13 }}>{s.action}</TableCell>
                <TableCell sx={{ fontSize: 13, color: rejected ? PEPE.short : undefined, fontWeight: rejected ? 'bold' : undefined }}>
                  {s.result}
                </TableCell>
                <TableCell>{s.tx ? txLink(s.tx) : <Typography variant="caption" color="text.secondary">{t.agentMode.recorded.offChain}</Typography>}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

