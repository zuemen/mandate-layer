import type { ReactNode } from 'react'
import { MONO } from 'src/components/pepefi/brandKit'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { parseUnits, formatUnits, Wallet, getAddress } from 'ethers'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import TextField from '@mui/material/TextField'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableRow from '@mui/material/TableRow'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableContainer from '@mui/material/TableContainer'

import { usePepefiWallet } from 'src/layouts/pepefi'
import { t, locale, interpolate } from 'src/locales'
import { prettyError } from 'src/lib/pepefi/errorMessages'
import { agentDid, shortDid } from 'src/lib/pepefi/did'
import { useToast } from 'src/components/pepefi/ToastProvider'
import BaseAccountSetupCard from 'src/components/pepefi/BaseAccountSetupCard'
import { CHAIN_NAMES } from 'src/contracts/addresses'
import {
  getSessionManager,
  getSessionManagerAddress,
  isSessionManagerDeployed,
} from 'src/contracts/sessionManager'
import {
  AUTH_DOMAIN,
  AUTH_TYPES,
  buildAuthTypedValue,
  assembleAuthorizationVC,
  type AuthorizationCaps,
  type AuthorizationVC,
} from 'src/contracts/agentAuth'

// ── Types ───────────────────────────────────────────────────────────────────
interface SessionRow {
  id:                number
  user:              string
  agent:             string
  maxMarginPerTrade: bigint
  totalMarginBudget: bigint
  spentMargin:       bigint
  maxLeverage:       bigint
  expiry:            bigint
  revoked:           boolean
}

type TxResp = { wait(): Promise<unknown>; hash: string }
const asTx = (tx: unknown): TxResp => tx as TxResp

const fUsdc = (v: bigint) => Number(formatUnits(v, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 })
const fDate = (ts: bigint) =>
  ts === 0n ? '—' : new Date(Number(ts) * 1000).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`

// 表單欄位：標籤置於框上方，避免 MUI 浮動標籤在有值時壓線/溢出。
function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const wallet = usePepefiWallet()
  const deployed = isSessionManagerDeployed(wallet.chainId)

  const manager = useMemo(
    () => getSessionManager(wallet.signer ?? wallet.provider, wallet.chainId),
    [wallet.signer, wallet.provider, wallet.chainId],
  )

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading,  setLoading]  = useState(false)
  const [busy,     setBusy]     = useState<Record<string, boolean>>({})
  const { notify } = useToast()

  // Create-session form
  const [agent,    setAgent]    = useState('')
  const [perTrade, setPerTrade] = useState('1000')
  const [budget,   setBudget]   = useState('5000')
  const [maxLev,   setMaxLev]   = useState('5')
  const [hours,    setHours]    = useState('24')

  // Generated agent burner key — **kept only in memory**, never persisted / sent.
  const [genKey,    setGenKey]    = useState<{ address: string; privateKey: string } | null>(null)
  const [revealKey, setRevealKey] = useState(false)
  const [includeKey, setIncludeKey] = useState(false) // opt-in: embed real key in exported MCP config

  // Generate a fresh agent-only keypair in the browser and auto-fill the address.
  const generateAgentKey = () => {
    const w = Wallet.createRandom()
    setGenKey({ address: w.address, privateKey: w.privateKey })
    setRevealKey(false)
    setIncludeKey(false)
    setAgent(w.address) // 自動填入 Agent address 欄
    notify(t.sessions.key.generated, true)
  }

  // Onboarding: issued VCs (persisted in localStorage, keyed by wallet+chain) +
  // which session's export dialog is open.
  const [vcBySession, setVcBySession] = useState<Record<number, AuthorizationVC>>({})
  const [exportFor,   setExportFor]   = useState<number | null>(null)

  // localStorage key for this wallet's issued VCs (per chain + address).
  const vcStorageKey = useCallback(
    () => (wallet.address ? `pepelab_vc_${wallet.chainId ?? 0}_${wallet.address.toLowerCase()}` : null),
    [wallet.address, wallet.chainId],
  )

  // Restore persisted VCs whenever the wallet / chain changes (survives reload).
  useEffect(() => {
    const k = vcStorageKey()
    if (!k) { setVcBySession({}); return }
    try {
      const raw = localStorage.getItem(k)
      setVcBySession(raw ? (JSON.parse(raw) as Record<number, AuthorizationVC>) : {})
    } catch {
      setVcBySession({})
    }
  }, [vcStorageKey])


  // ── Export helpers ──────────────────────────────────────────────────────────
  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify(interpolate(t.sessions.copied, { label }), true)
    } catch {
      notify(t.sessions.copyFailed, false)
    }
  }
  const downloadJson = (filename: string, obj: unknown) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Whether the generated burner key belongs to a given session's agent (so the
  // export can offer to embed it). Compares checksummed addresses.
  const genKeyMatchesAgent = (agentAddr: string): boolean => {
    if (!genKey) return false
    try { return getAddress(genKey.address) === getAddress(agentAddr) } catch { return false }
  }

  // Claude Desktop / Code MCP config — auto-filled. AGENT_PRIVATE_KEY stays a
  // placeholder UNLESS the user explicitly opts to embed the key they just
  // generated on this page (includeKey + same agent). The website never embeds
  // any other private key.
  const mcpConfig = (sessionId: number, agentAddr: string) => ({
    mcpServers: {
      'pepelab-cfd': {
        command: 'npx',
        args: ['-y', 'tsx', '/path/to/mandate-layer/agent/mcp-server/src/index.ts'],
        env: {
          AGENT_PRIVATE_KEY:
            includeKey && genKeyMatchesAgent(agentAddr) && genKey
              ? genKey.privateKey
              : t.sessions.export.privateKeyPlaceholder,
          SESSION_MANAGER_ADDRESS: getSessionManagerAddress(wallet.chainId),
          BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
          DEMO_SESSION_ID: String(sessionId),
        },
      },
    },
  })

  // ── Issue authorization VC (user signs in MetaMask — SSI issuer role) ─────────
  const issueCredential = async (s: SessionRow) => {
    if (!wallet.signer || !wallet.address) {
      notify(t.sessions.list.needsRealWallet, false)
      return
    }
    const key = `vc_${s.id}`
    try {
      setBusy(p => ({ ...p, [key]: true }))
      const caps: AuthorizationCaps = {
        maxMarginPerTrade: formatUnits(s.maxMarginPerTrade, 18),
        totalBudget:       formatUnits(s.totalMarginBudget, 18),
        maxLeverage:       Number(s.maxLeverage),
        expiry:            Number(s.expiry),
      }
      const issuedAt = Math.floor(Date.now() / 1000)
      // 與 agent 端 verifyAuthorizationVC 共用同一組 EIP-712 schema（agentAuth.ts）。
      const value = buildAuthTypedValue({ issuer: wallet.address, agent: s.agent, sessionId: s.id, caps, issuedAt })
      const signature = await wallet.signer.signTypedData(AUTH_DOMAIN, AUTH_TYPES, value)
      const vc = assembleAuthorizationVC({
        issuerAddress: wallet.address, agentAddress: s.agent, sessionId: s.id, caps, issuedAt, signature,
      })
      setVcBySession(p => {
        const nextMap = { ...p, [s.id]: vc }
        const k = vcStorageKey()
        if (k) { try { localStorage.setItem(k, JSON.stringify(nextMap)) } catch { /* quota — keep in memory */ } }
        return nextMap
      })
      setExportFor(s.id)
      notify(t.sessions.list.credentialIssued, true)
    } catch (e) {
      notify(prettyError(e), false)
    } finally {
      setBusy(p => ({ ...p, [key]: false }))
    }
  }

  // ── Fetch this wallet's sessions ──────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    if (!manager || !wallet.address) return
    setLoading(true)
    try {
      const next = Number(await manager.nextSessionId())
      const mine: SessionRow[] = []
      for (let i = 0; i < next; i++) {
        const s = (await manager.sessions(i)) as unknown as [
          string, string, bigint, bigint, bigint, bigint, bigint, boolean,
        ]
        if (s[0].toLowerCase() === wallet.address.toLowerCase()) {
          mine.push({
            id: i, user: s[0], agent: s[1],
            maxMarginPerTrade: s[2], totalMarginBudget: s[3], spentMargin: s[4],
            maxLeverage: s[5], expiry: s[6], revoked: s[7],
          })
        }
      }
      setSessions(mine)
    } catch (e) {
      notify(prettyError(e), false)
    } finally {
      setLoading(false)
    }
  }, [manager, wallet.address])

  useEffect(() => { void fetchSessions() }, [fetchSessions])

  // ── Create session ────────────────────────────────────────────────────────
  const createSession = async () => {
    if (!manager) return
    try {
      const expiry = Math.floor(Date.now() / 1000) + Math.round(parseFloat(hours) * 3600)
      setBusy(p => ({ ...p, create: true }))
      const tx = asTx(await manager.createSession(
        agent.trim(),
        parseUnits(perTrade || '0', 18),
        parseUnits(budget || '0', 18),
        BigInt(maxLev || '0'),
        BigInt(expiry),
      ))
      await tx.wait()
      notify(t.sessions.create.done, true, tx.hash)
      setAgent('')
      await fetchSessions()
    } catch (e) {
      notify(prettyError(e), false)
    } finally {
      setBusy(p => ({ ...p, create: false }))
    }
  }

  // ── Revoke session ────────────────────────────────────────────────────────
  const revokeSession = async (id: number) => {
    if (!manager) return
    const key = `revoke_${id}`
    try {
      setBusy(p => ({ ...p, [key]: true }))
      const tx = asTx(await manager.revokeSession(id))
      await tx.wait()
      notify(t.sessions.list.revoked, true, tx.hash)
      await fetchSessions()
    } catch (e) {
      notify(prettyError(e), false)
    } finally {
      setBusy(p => ({ ...p, [key]: false }))
    }
  }

  const statusOf = (s: SessionRow): { label: string; color: 'success' | 'warning' | 'default' } => {
    if (s.revoked) return { label: t.sessions.list.status.revoked, color: 'default' }
    if (Number(s.expiry) * 1000 < Date.now())
      return { label: t.sessions.list.status.expired, color: 'warning' }
    return { label: t.sessions.list.status.active, color: 'success' }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!wallet.isConnected) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Typography color="text.secondary">Connect wallet to manage agent sessions.</Typography>
      </Box>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* Header */}
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{t.sessions.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t.sessions.markup.introBefore}<b>did:pkh</b>{t.sessions.markup.introMid}<b>W3C VC</b>{t.sessions.markup.introAfter}
        </Typography>
      </Box>

      {/* SSI 角色說明 — 一眼看懂三角 */}
      <Alert severity="info" variant="outlined" icon={false}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          {t.sessions.ssi.title}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 3 }} sx={{ typography: 'caption' }}>
          <span>{t.sessions.markup.roleIssuerBefore}<b>{t.sessions.markup.roleIssuerBold}</b>{t.sessions.markup.roleIssuerAfter}</span>
          <span>{t.sessions.markup.roleHolderBefore}<b>{t.sessions.markup.roleHolderBold}</b>{t.sessions.markup.roleHolderAfter}</span>
          <span>{t.sessions.markup.roleVerifierBefore}<b>{t.sessions.markup.roleVerifierBold}</b>{t.sessions.markup.roleVerifierAfter}</span>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {t.sessions.ssi.flow}
        </Typography>
      </Alert>

      {!deployed ? (
        <Alert severity="warning">
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {t.sessions.wrongNetwork.title}
          </Typography>
          {t.sessions.markup.wrongNetBefore}<b>Base Sepolia</b>{t.sessions.markup.wrongNetMid}{' '}
          <b>{wallet.chainId !== null ? (CHAIN_NAMES[wallet.chainId] ?? `chainId ${wallet.chainId}`) : t.sessions.wrongNetwork.unknownChain}</b>
          {t.sessions.markup.wrongNetAfter}
        </Alert>
      ) : (
        <>
          {/* Create session */}
          <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.sessions.create.title}</Typography>

            {/* 觀念說明：agent 用獨立 session key，不是主錢包 */}
            <Alert severity="info" variant="outlined" icon={false} sx={{ py: 0.5 }}>
              <Typography variant="caption">
                <b>{t.sessions.markup.keyNoteBold1}</b>{t.sessions.markup.keyNoteMid1}
                <b>{t.sessions.markup.keyNoteBold2}</b>{t.sessions.markup.keyNoteMid2}<b>{t.sessions.markup.keyNoteBold3}</b>{t.sessions.markup.keyNoteAfter}
              </Typography>
            </Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-end' }}>
              <Labeled label={t.sessions.create.agentAddress}>
                <TextField
                  placeholder={t.sessions.create.agentPlaceholder}
                  value={agent}
                  onChange={e => setAgent(e.target.value)}
                  size="small"
                  fullWidth
                />
              </Labeled>
              <Button
                variant="outlined"
                onClick={generateAgentKey}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 180 }}
                startIcon={<span>🔑</span>}
              >
                {t.sessions.create.generateKey}
              </Button>
            </Stack>

            {/* 產生的金鑰只顯示一次（記憶體，不入庫/不上傳） */}
            {genKey && (
              <Alert severity="warning" variant="outlined" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{t.sessions.key.title}</Typography>
                  <Button size="small" variant="text" color="inherit" onClick={() => { setGenKey(null); setRevealKey(false); setIncludeKey(false) }} sx={{ textTransform: 'none' }}>{t.sessions.key.clear}</Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t.sessions.markup.burnerWarnBefore}<b>{t.sessions.markup.burnerWarnBold}</b>{t.sessions.markup.burnerWarnAfter}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip size="small" label={t.sessions.key.addressChip} color="success" variant="outlined" />
                  <Typography variant="caption" sx={{ fontFamily: MONO, wordBreak: 'break-all', flex: 1 }}>{genKey.address}</Typography>
                  <Button size="small" variant="outlined" onClick={() => void copyText(t.sessions.key.copyAddressLabel, genKey.address)} sx={{ textTransform: 'none' }}>{t.sessions.key.copy}</Button>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label={t.sessions.key.privateKeyChip} color="error" variant="outlined" />
                  <Typography variant="caption" sx={{ fontFamily: MONO, wordBreak: 'break-all', flex: 1 }}>
                    {revealKey ? genKey.privateKey : '•'.repeat(24) + t.sessions.key.hiddenSuffix}
                  </Typography>
                  <Button size="small" variant="text" onClick={() => setRevealKey(v => !v)} sx={{ textTransform: 'none', minWidth: 0 }}>{revealKey ? t.sessions.key.hide : t.sessions.key.reveal}</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => void copyText(t.sessions.key.copyPrivateKeyLabel, genKey.privateKey)} sx={{ textTransform: 'none' }}>{t.sessions.key.copy}</Button>
                </Box>
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Labeled label={t.sessions.create.maxPerTrade}>
                <TextField type="number" value={perTrade} placeholder="1000"
                  onChange={e => setPerTrade(e.target.value)} size="small" fullWidth />
              </Labeled>
              <Labeled label={t.sessions.create.totalBudget}>
                <TextField type="number" value={budget} placeholder="5000"
                  onChange={e => setBudget(e.target.value)} size="small" fullWidth />
              </Labeled>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Labeled label={t.sessions.create.maxLeverage}>
                <TextField type="number" value={maxLev} placeholder="5"
                  onChange={e => setMaxLev(e.target.value)} size="small" fullWidth
                  slotProps={{ htmlInput: { min: 1, max: 5 } }} />
              </Labeled>
              <Labeled label={t.sessions.create.validFor}>
                <TextField type="number" value={hours} placeholder="24"
                  onChange={e => setHours(e.target.value)} size="small" fullWidth />
              </Labeled>
            </Stack>
            <Box>
              <Button
                variant="contained"
                onClick={() => void createSession()}
                disabled={!agent.trim() || !!busy.create}
              >
                {busy.create ? t.sessions.create.creating : t.sessions.create.cta}
              </Button>
            </Box>
          </Card>

          {/* Base Account + Base Spend Permission: the same caps, in one wallet batch */}
          <BaseAccountSetupCard
            agent={agent}
            perTrade={perTrade}
            budget={budget}
            maxLeverage={maxLev}
            hours={hours}
            onDone={() => void fetchSessions()}
          />

          {/* Session list */}
          <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{t.sessions.list.title}</Typography>
              <Button variant="text" size="small" onClick={() => void fetchSessions()} sx={{ textTransform: 'none' }}>
                {t.sessions.list.refresh}
              </Button>
            </Box>

            {loading ? (
              <Typography variant="body2" color="text.secondary">{t.sessions.list.loading}</Typography>
            ) : sessions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t.sessions.list.empty}</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'background.neutral' }}>
                      {[
                        t.sessions.list.column.id,
                        t.sessions.list.column.agent,
                        t.sessions.list.column.spent,
                        t.sessions.list.column.maxPerTrade,
                        t.sessions.list.column.leverage,
                        t.sessions.list.column.expiry,
                        t.sessions.list.column.status,
                        t.sessions.list.column.credential,
                        '',
                      ].map(h => (
                        <TableCell key={h} sx={{ color: 'text.secondary', fontWeight: 'bold' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sessions.map(s => {
                      const st = statusOf(s)
                      const key = `revoke_${s.id}`
                      return (
                        <TableRow key={s.id} hover>
                          <TableCell sx={{ fontFamily: MONO }}>{s.id}</TableCell>
                          <TableCell sx={{ fontFamily: MONO }}>
                            {short(s.agent)}
                            <Box component="span" sx={{ display: 'block', fontSize: 10, color: 'text.disabled' }} title={agentDid(s.agent)}>
                              {shortDid(s.agent)}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontFamily: MONO }}>{fUsdc(s.spentMargin)} / {fUsdc(s.totalMarginBudget)}</TableCell>
                          <TableCell sx={{ fontFamily: MONO }}>{fUsdc(s.maxMarginPerTrade)}</TableCell>
                          <TableCell sx={{ fontFamily: MONO }}>{Number(s.maxLeverage)}x</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{fDate(s.expiry)}</TableCell>
                          <TableCell><Chip size="small" label={st.label} color={st.color} variant="outlined" /></TableCell>
                          <TableCell>
                            {vcBySession[s.id] ? (
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Chip size="small" label={t.sessions.list.issued} color="success" variant="outlined" />
                                <Button
                                  size="small" variant="outlined" color="primary"
                                  onClick={() => setExportFor(s.id)}
                                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                                >
                                  {t.sessions.list.export}
                                </Button>
                              </Stack>
                            ) : (
                              <Button
                                size="small" variant="outlined"
                                onClick={() => void issueCredential(s)}
                                disabled={s.revoked || Number(s.expiry) * 1000 < Date.now() || !!busy[`vc_${s.id}`] || !wallet.signer}
                                sx={{ textTransform: 'none' }}
                                title={!wallet.signer ? t.sessions.list.issueVcNeedsWallet : t.sessions.list.issueVcHint}
                              >
                                {busy[`vc_${s.id}`] ? t.sessions.list.signing : t.sessions.list.issueVc}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small" variant="outlined" color="error"
                              onClick={() => void revokeSession(s.id)}
                              disabled={s.revoked || !!busy[key]}
                              sx={{ textTransform: 'none' }}
                            >
                              {busy[key] ? t.sessions.working : t.sessions.list.revoke}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>

          {/* Export / Connect your Agent — modal dialog (centered, always reachable) */}
          <Dialog
            open={exportFor !== null && !!vcBySession[exportFor ?? -1]}
            onClose={() => setExportFor(null)}
            maxWidth="md"
            fullWidth
            scroll="paper"
          >
            {exportFor !== null && vcBySession[exportFor] && (() => {
              const sid = exportFor
              const vc = vcBySession[sid]
              const sessAgent = sessions.find(s => s.id === sid)?.agent ?? vc.credentialSubject.id.split(':').pop() ?? ''
              const canIncludeKey = genKeyMatchesAgent(sessAgent)
              const cfg = mcpConfig(sid, sessAgent)
              const cfgStr = JSON.stringify(cfg, null, 2)
              const vcStr = JSON.stringify(vc, null, 2)
              const preSx = {
                fontFamily: MONO, fontSize: 11, m: 0, p: 1.5, borderRadius: 1,
                bgcolor: 'background.neutral', maxHeight: 220, overflow: 'auto', whiteSpace: 'pre' as const,
              }
              return (
                <>
                  <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 1 }}>
                    {interpolate(t.sessions.export.title, { id: sid })}
                    <IconButton onClick={() => setExportFor(null)} size="small" aria-label={t.sessions.export.closeAria}>✕</IconButton>
                  </DialogTitle>
                  <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t.sessions.export.intro}
                    </Typography>
                    <Box component="ol" sx={{ pl: 2.5, m: 0, typography: 'caption', color: 'text.secondary' }}>
                      <li>{t.sessions.markup.step1Before}<b>{t.sessions.markup.step1Bold}</b>{t.sessions.markup.step1Mid1}<code>mcpServers</code>{t.sessions.markup.step1Mid2}<code>AGENT_PRIVATE_KEY</code>{t.sessions.markup.step1After}</li>
                      <li>{t.sessions.markup.step2Before}<b>{t.sessions.markup.step2Bold}</b>{t.sessions.markup.step2Mid1}<code>AGENT_AUTH_VC_PATH</code>{t.sessions.markup.step2Mid2}<code>open_position</code>{t.sessions.markup.step2Mid3}<code>authVcJson</code>{t.sessions.markup.step2After}</li>
                      <li>{t.sessions.markup.step3}</li>
                    </Box>

                    {/* 地址 vs 私鑰 對應，避免混淆 */}
                    <Alert severity="info" variant="outlined" icon={false} sx={{ py: 0.5 }}>
                      <Typography variant="caption">
                        <b>{t.sessions.markup.addrKeyBold1}</b>{t.sessions.markup.addrKeyMid1}<code>{short(sessAgent)}</code>{t.sessions.markup.addrKeyMid2}
                        <b>{t.sessions.markup.addrKeyBold2}</b>{t.sessions.markup.addrKeyAfter}<code>AGENT_PRIVATE_KEY</code>{t.sessions.markup.addrKeyTail}
                      </Typography>
                    </Alert>

                    {/* MCP config */}
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{t.sessions.export.mcpTitle}</Typography>
                        <Button size="small" variant="outlined" onClick={() => void copyText(t.sessions.export.copyMcpLabel, cfgStr)} sx={{ textTransform: 'none' }}>{t.sessions.export.copy}</Button>
                        <Button size="small" variant="outlined" onClick={() => downloadJson(`pepelab-mcp-session-${sid}.json`, cfg)} sx={{ textTransform: 'none' }}>{t.sessions.export.download}</Button>
                      </Stack>
                      {canIncludeKey ? (
                        <FormControlLabel
                          control={<Checkbox size="small" color="error" checked={includeKey} onChange={e => setIncludeKey(e.target.checked)} />}
                          label={
                            <Typography variant="caption" color={includeKey ? 'error.main' : 'text.secondary'}>
                              {t.sessions.markup.includeKeyBefore}<code>AGENT_PRIVATE_KEY</code>{t.sessions.markup.includeKeyAfter}
                            </Typography>
                          }
                          sx={{ mb: 0.5 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          <code>AGENT_PRIVATE_KEY</code>{t.sessions.markup.placeholderAfter}
                        </Typography>
                      )}
                      <Box component="pre" sx={preSx}>{cfgStr}</Box>
                    </Box>

                    {/* Authorization VC */}
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{t.sessions.export.vcTitle}</Typography>
                        <Button size="small" variant="outlined" onClick={() => void copyText(t.sessions.export.copyVcLabel, vcStr)} sx={{ textTransform: 'none' }}>{t.sessions.export.copy}</Button>
                        <Button size="small" variant="outlined" onClick={() => downloadJson(`pepelab-auth-vc-session-${sid}.json`, vc)} sx={{ textTransform: 'none' }}>{t.sessions.export.download}</Button>
                      </Stack>
                      <Box component="pre" sx={preSx}>{vcStr}</Box>
                    </Box>

                    <Alert severity="warning" variant="outlined">
                      <Typography variant="caption">
                        {t.sessions.markup.finalWarnBefore}<b>{t.sessions.markup.finalWarnBold1}</b>{t.sessions.markup.finalWarnMid1}<code>AGENT_PRIVATE_KEY</code>{t.sessions.markup.finalWarnMid2}<b>{t.sessions.markup.finalWarnBold2}</b>{t.sessions.markup.finalWarnAfter}
                      </Typography>
                    </Alert>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setExportFor(null)} sx={{ textTransform: 'none' }}>{t.sessions.export.close}</Button>
                  </DialogActions>
                </>
              )
            })()}
          </Dialog>

          <Divider />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
            {interpolate(t.sessions.sessionManager, {
              address: short(getSessionManagerAddress(wallet.chainId)),
            })}
          </Typography>
        </>
      )}
    </Container>
  )
}
