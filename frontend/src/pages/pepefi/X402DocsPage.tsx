import { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

import { t, interpolate } from 'src/locales'
import { SIGNAL_API_URL, SIGNAL_API_AVAILABLE, demoBuySignal } from 'src/lib/pepefi/signalApi'
import { Mono as Num, LiveDot, PEPE, MONO, hexA } from 'src/components/pepefi/brandKit'

interface RevenueTotals {
  count: number
  feeUsd: number
  traderShare: number
  platformShare: number
  vaultShare: number
}

// endpoint = product. 定價卡資料。
const PRODUCTS = [
  {
    method: 'GET',
    path: '/signals/:trader',
    price: '$0.01',
    blurb: t.x402.docs.product.signals,
    accent: PEPE.green,
  },
  {
    method: 'GET',
    path: '/oracle/:asset',
    price: '$0.005',
    blurb: t.x402.docs.product.oracle,
    accent: PEPE.gold,
  },
] as const

const OFFICIAL_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
// mandate-layer's own x402 FeeRouter (DeployX402Router, 2026-09-23), bound to
// Circle's official Base Sepolia USDC. Not the original project's router.
const X402_FEE_ROUTER = '0xEeDcEE7cD62A644EA4Cf053f213d5D75dB0B49c6'
const basescanTx = (h: string) => `https://sepolia.basescan.org/tx/${h}`

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <Box component="pre" sx={{
      m: 0, p: 2, borderRadius: 1, bgcolor: 'background.neutral', overflowX: 'auto',
      fontFamily: MONO, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>{children}</Box>
  )
}

// 即時 70/20/10 分潤條（讀鏈上 /revenue）。
function SplitBar({ rev }: { rev: RevenueTotals | null }) {
  const segs = [
    { label: t.x402.docs.split.traders, pct: 70, val: rev?.traderShare, color: PEPE.green },
    { label: t.x402.docs.split.platform, pct: 20, val: rev?.platformShare, color: PEPE.gold },
    { label: t.x402.docs.split.vault, pct: 10, val: rev?.vaultShare, color: '#00B8D9' },
  ]
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        {rev && <LiveDot size={6} />}
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {t.x402.docs.split.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {t.x402.docs.split.accrued}{' '}
          <Num tone="green">${(rev?.feeUsd ?? 0).toFixed(3)}</Num>{' · '}
          <Num tone="muted">
            {interpolate(t.x402.docs.split.calls, { count: rev?.count ?? 0 })}
          </Num>
        </Typography>
      </Stack>
      <Box sx={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', mb: 1.5 }}>
        {segs.map((s) => (
          <Box key={s.label} sx={{ width: `${s.pct}%`, bgcolor: s.color, opacity: 0.85 }} />
        ))}
      </Box>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        {segs.map((s) => (
          <Stack key={s.label} direction="row" alignItems="center" spacing={0.8}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
            <Typography variant="caption" color="text.secondary">
              {interpolate(t.x402.docs.split.share, { label: s.label, pct: s.pct })}
            </Typography>
            <Num tone="muted" sx={{ fontSize: 12 }}>
              ${(s.val ?? 0).toFixed(4)}
            </Num>
          </Stack>
        ))}
      </Stack>
    </Card>
  )
}

export default function X402DocsPage() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof demoBuySignal>> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rev, setRev] = useState<RevenueTotals | null>(null)

  useEffect(() => {
    // 沒有公開的 signal-api 就不連（見 isPublicSignalApi）。
    if (!SIGNAL_API_AVAILABLE) return undefined
    let off = false
    const pull = async () => {
      try {
        const r = await (await fetch(`${SIGNAL_API_URL}/revenue`)).json()
        if (!off && r?.totals) setRev(r.totals)
      } catch {
        /* API 未連上 → 靜默 */
      }
    }
    void pull()
    const id = setInterval(pull, 15_000)
    return () => {
      off = true
      clearInterval(id)
    }
  }, [])

  const tryBuy = async () => {
    setBusy(true); setErr(null); setResult(null)
    try {
      const r = await demoBuySignal()
      if (r.ok) setResult(r)
      else setErr(r.error ?? t.x402.docs.tryBuy.failed)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.x402.docs.tryBuy.networkError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap">
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{t.x402.docs.title}</Typography>
          <Chip size="small" color="primary" variant="outlined" label={t.x402.docs.audienceChip} />
          <Chip size="small" color="success" label={t.x402.docs.commerceChip} />
        </Stack>
        <Typography color="text.secondary">
          <b>{t.x402.docs.introBold1}</b>{t.x402.docs.introMid}<b>{t.x402.docs.introBold2}</b>{t.x402.docs.introAfter}
        </Typography>
      </Box>

      {/* facts */}
      <Card sx={{ p: 2.5 }}>
        <Stack spacing={1.2}>
          {[
            [t.x402.docs.fact.baseUrl, SIGNAL_API_AVAILABLE ? SIGNAL_API_URL : SIGNAL_API_URL + t.x402.docs.offline.baseUrlSuffix],
            [t.x402.docs.fact.network, 'base-sepolia (84532)'],
            [
              t.x402.docs.fact.asset,
              interpolate(t.x402.docs.fact.assetValue, { address: OFFICIAL_USDC }),
            ],
            [t.x402.docs.fact.router, X402_FEE_ROUTER],
            [t.x402.docs.fact.pricing, t.x402.docs.fact.pricingValue],
          ].map(([k, v]) => (
            <Box key={k} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130, fontWeight: 'bold' }}>{k}</Typography>
              <Typography variant="body2" sx={{ fontFamily: MONO, wordBreak: 'break-all' }}>{v}</Typography>
            </Box>
          ))}
        </Stack>
      </Card>

      {/* pricing cards — endpoint = product */}
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 'bold', letterSpacing: 2 }}>
          {t.x402.docs.product.heading}
        </Typography>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {PRODUCTS.map((p) => (
            <Grid size={{ xs: 12, sm: 6 }} key={p.path}>
              <Card
                sx={{
                  p: 2.5,
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: hexA(p.accent, 0.25),
                  transition: 'transform .25s, border-color .25s',
                  '&:hover': { transform: 'translateY(-4px)', borderColor: hexA(p.accent, 0.6) },
                  '&::before': {
                    content: '""', position: 'absolute', top: 0, left: 0, width: '100%', height: 3,
                    background: `linear-gradient(90deg, ${p.accent}, transparent)`,
                  },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Chip size="small" label={p.method} sx={{ bgcolor: hexA(p.accent, 0.15), color: p.accent, fontWeight: 700, fontFamily: MONO }} />
                  <Num sx={{ fontSize: 14, color: p.accent }}>{p.path}</Num>
                </Stack>
                <Typography component="div" sx={{ fontSize: 28, lineHeight: 1, mb: 1 }}>
                  <Num glow sx={{ color: p.accent }}>{p.price}</Num>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {t.x402.docs.product.perCall}
                  </Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary">{p.blurb}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* live 70/20/10 split */}
      {SIGNAL_API_AVAILABLE ? (
        <SplitBar rev={rev} />
      ) : (
        <Card sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>{t.x402.docs.split.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t.x402.docs.offline.split}{' '}
            <Link component={RouterLink} to="/agent-mode">{t.x402.docs.offline.link}</Link>
          </Typography>
        </Card>
      )}

      {/* try-buy */}
      <Card sx={{ p: 3, borderLeft: '3px solid', borderColor: 'success.main' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>{t.x402.docs.tryBuy.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t.x402.docs.tryBuy.description}
        </Typography>
        {!SIGNAL_API_AVAILABLE && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t.x402.docs.offline.tryBuy}{' '}
            <Link component={RouterLink} to="/agent-mode" color="inherit" sx={{ textDecoration: 'underline' }}>
              {t.x402.docs.offline.link}
            </Link>
          </Alert>
        )}
        <Button variant="contained" color="success" disabled={busy || !SIGNAL_API_AVAILABLE} onClick={() => void tryBuy()}>
          {busy ? t.x402.docs.tryBuy.busy : t.x402.docs.tryBuy.cta}
        </Button>
        {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}
        {result && (
          <Box sx={{ mt: 2 }}>
            {result.settlementTx && (
              <Alert severity="success" sx={{ mb: 1 }}>
                {t.x402.docs.tryBuy.settled}
                <Link href={basescanTx(result.settlementTx)} target="_blank" rel="noopener" color="inherit" sx={{ textDecoration: 'underline' }}>
                  {t.x402.docs.tryBuy.viewSettlement}
                </Link>
              </Alert>
            )}
            <Mono>{JSON.stringify(result.signal ?? result, null, 2)}</Mono>
          </Box>
        )}
      </Card>

      <Divider>{t.x402.docs.external.divider}</Divider>

      {/* curl + node */}
      <Card sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>{t.x402.docs.external.step1}</Typography>
        <Mono>{`curl -s ${SIGNAL_API_URL}/`}</Mono>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>{t.x402.docs.external.step2}</Typography>
        <Mono>{`# agent/examples/buy-signal.ts — needs only viem + x402-fetch
export X402_API_URL=${SIGNAL_API_URL}
export AGENT_PRIVATE_KEY=0x...   # holds Circle USDC + a little ETH
npx tsx examples/buy-signal.ts`}</Mono>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t.x402.docs.external.flow}
        </Typography>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
        {t.x402.docs.footer}
      </Typography>
    </Container>
  )
}
