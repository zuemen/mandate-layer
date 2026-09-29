import { Link as RouterLink } from 'react-router';
import { usePepefiWallet } from 'src/layouts/pepefi';
import { t } from 'src/locales';
import WalletButton from 'src/components/pepefi/WalletButton';
import HeroKpiStrip from 'src/components/pepefi/HeroKpiStrip';
import { SHOW_PERPETUALS } from 'src/lib/pepefi/featureFlags';
import BenchmarkStrip from 'src/components/pepefi/dashboard/BenchmarkStrip';
import { SIGNAL_API_AVAILABLE } from 'src/lib/pepefi/signalApi';
import PaperTradingBadge from 'src/components/pepefi/PaperTradingBadge';
import { MONO } from 'src/components/pepefi/brandKit';
import { Iconify } from 'src/components/iconify';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';

const FEATURES = [
  // Iconify rather than emoji. Emoji render from whatever font the OS supplies,
  // so these six drew at six different weights and baselines depending on the
  // machine, and none of them could inherit the panel's colour. The mascot 🐸
  // stays — that is brand, not an icon.
  // RWA 現貨排第一，是刻意的：教授看的是「這是不是 RWA 平台」，而第一張卡就是
  // 答案。永續那張已經移出這個陣列——SHOW_PERPETUALS 預設關的時候，首頁介紹一個
  // 側邊欄上不存在的功能只會讓人去找它。要展示永續時打開旗標，PERPETUAL_FEATURE
  // 會接回去。
  { icon: 'solar:case-minimalistic-bold',          title: t.landing.features.rwaTitle,        desc: t.landing.features.rwaDesc },
  { icon: 'solar:copy-bold',                       title: t.landing.features.copyTitle,       desc: t.landing.features.copyDesc },
  { icon: 'solar:verified-check-bold',             title: t.landing.features.esgTitle,        desc: t.landing.features.esgDesc },
  { icon: 'solar:shield-keyhole-bold-duotone',     title: t.landing.features.vaultTitle,      desc: t.landing.features.vaultDesc },
  { icon: 'solar:wad-of-money-bold',               title: t.landing.features.x402Title,       desc: t.landing.features.x402Desc },
  { icon: 'solar:atom-bold-duotone',               title: t.landing.features.agentTitle,      desc: t.landing.features.agentDesc },
  // `as const` so the icon strings keep their literal types. Iconify's `icon`
  // prop is a union of the 206 names registered in components/iconify/icon-sets
  // (which inlines each SVG body, so icons ship with the bundle rather than
  // being fetched). Without this the array widens to `string` and the check
  // that catches a typo'd or unregistered icon at compile time is lost.
] as const;

/** 只有 SHOW_PERPETUALS 打開時才接回功能卡的那一張。 */
const PERPETUAL_FEATURE = {
  icon: 'solar:chart-square-outline',
  title: t.landing.features.perpetualsTitle,
  desc: t.landing.features.perpetualsDesc,
} as const;

const VISIBLE_FEATURES = SHOW_PERPETUALS ? [...FEATURES, PERPETUAL_FEATURE] : FEATURES;

const STEPS = [
  { n: '01', text: t.landing.steps.one },
  { n: '02', text: t.landing.steps.two },
  { n: '03', text: t.landing.steps.three },
  { n: '04', text: t.landing.steps.four },
];

export default function LandingPage() {
  const wallet = usePepefiWallet();

  return (
    <Box
      sx={{
        // dvh, not vh: on mobile Safari/Chrome `100vh` is the viewport with the
        // URL bar *hidden*, so the hero overflows by the bar's height until the
        // user scrolls. dvh tracks the visible viewport.
        minHeight: '100dvh',
        background: 'radial-gradient(120% 80% at 80% -10%, rgba(124,193,74,0.10) 0%, transparent 55%), linear-gradient(165deg, #0A0F0B 0%, #0d1f12 55%, #0A0F0B 100%)',
        pt: 8,
        pb: 8,
      }}
    >
      <Container maxWidth="md">
        {/* ── HERO ── */}
        <Box sx={{ position: 'relative', mb: 6 }}>
          {/* Six floating emoji (🚀 💰 ✨ 🌙 ⚡ 🔥) used to bob around the hero
              on a 3s infinite loop. Removed rather than restyled:

              - They carried no meaning. The first thing a visitor evaluating a
                venue for tokenised RWAs saw was decoration.
              - ⚡ was ALSO one of the six feature icons below, so the same glyph
                meant "Agent-Native Trading" in one place and nothing at all in
                another, twelve hundred pixels apart.
              - @keyframes floatBob was declared inside the .map, so emotion
                emitted six identical copies of the same keyframe rule.

              The mascot and the wordmark carry the brand; these did not. */}

          {/* Two-column layout: text left, Pepe right */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems="center"
            justifyContent="space-between"
            spacing={4}
          >
            {/* Left: text */}
            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
              {/* Wordmark */}
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '3rem', md: '5rem' },
                  fontWeight: 900,
                  lineHeight: 0.95,
                  color: 'var(--palette-primary-main)',
                  textShadow: '-1px -1px 0 var(--palette-secondary-main), 1px -1px 0 var(--palette-secondary-main), -1px 1px 0 var(--palette-secondary-main), 1px 1px 0 var(--palette-secondary-main), 0 0 40px rgba(124,193,74,0.6)',
                  mb: 1.5,
                }}
              >
                Mandate Layer
              </Typography>

              {/* Mono kicker — "on-chain terminal" cred */}
              <Typography sx={{
                fontFamily: MONO,
                fontSize: { xs: '0.8rem', md: '0.95rem' },
                fontWeight: 600,
                letterSpacing: { xs: '1px', md: '2px' },
                color: 'var(--palette-primary-main)',
                textTransform: 'uppercase',
                mb: 2.5,
              }}>
                {/* 這行是 ASCII，所以「不准硬編顯示字串」的 ratchet（只掃 CJK）
                    抓不到它，它就這樣掛在 logo 底下寫著 perpetuals，與整站改成
                    現貨門面之後的每一句話打架。改成 catalog 的 brandLine。 */}
                {'>'} {t.landing.brandLine}
              </Typography>

              {/* Meme energy tagline */}
              <Typography sx={{
                fontSize: { xs: '0.95rem', md: '1.35rem' },
                fontWeight: 700,
                letterSpacing: { xs: '2px', md: '3px' },
                color: '#cad8b0',
                textTransform: 'uppercase',
                mb: 3,
              }}>
                {t.landing.tagline}
              </Typography>

              <Typography variant="body1" sx={{
                color: 'text.secondary',
                maxWidth: 500,
                lineHeight: 1.7,
                fontSize: { xs: '1rem', md: '1.15rem' },
                mb: 4,
                mx: { xs: 'auto', md: 0 },
              }}>
                {t.landing.markup.heroBefore}<b style={{ color: 'var(--palette-primary-main)' }}>{t.landing.markup.heroBold}</b>{t.landing.markup.heroAfter}
              </Typography>

              <Stack direction="row" spacing={2} justifyContent={{ xs: 'center', md: 'flex-start' }} flexWrap="wrap">
                {/* Colosseum build: the judge entry point, wallet-free. */}
                <Button
                  component={RouterLink}
                  to="/agent-mode"
                  variant="contained"
                  size="large"
                  sx={{ bgcolor: 'var(--palette-primary-main)', color: 'primary.contrastText', fontWeight: 900, '&:hover': { bgcolor: 'var(--palette-primary-dark)' } }}
                >
                  {t.landing.agentModeCta}
                </Button>
                <WalletButton wallet={wallet} />
                {wallet.isConnected && (
                  <Button
                    component={RouterLink}
                    to="/portfolio"
                    variant="contained"
                    size="large"
                    // contrastText, not #fff: white on this green measures
                    // 2.19:1, below the 4.5:1 floor. The token is 7.08:1.
                    sx={{ bgcolor: 'var(--palette-primary-main)', color: 'primary.contrastText', fontWeight: 900, '&:hover': { bgcolor: 'var(--palette-primary-dark)' } }}
                  >
                    {t.landing.enterDashboard}
                  </Button>
                )}
                <Button
                  component={RouterLink}
                  to="/marketplace"
                  variant="outlined"
                  size="large"
                  sx={{ borderColor: 'var(--palette-primary-main)', color: 'var(--palette-primary-main)', '&:hover': { bgcolor: 'rgba(124,193,74,0.1)' } }}
                >
                  {t.landing.viewTraders}
                </Button>
              </Stack>
            </Box>

            {/* Right: the mandate, drawn: a session boundary and a path stopped at the per-trade cap */}
            <Box sx={{
              position: 'relative',
              flexShrink: 0,
              width: { xs: 220, md: 360 },
              height: { xs: 220, md: 360 },
            }}>
              {/* Glow ring */}
              <Box sx={{
                position: 'absolute', inset: -8,
                borderRadius: '24px',
                background: 'radial-gradient(circle, rgba(124,193,74,0.25) 0%, transparent 70%)',
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%,100%': { opacity: 0.6, transform: 'scale(1)' },
                  '50%': { opacity: 1, transform: 'scale(1.05)' },
                },
              }} />
              <Box
                component="img"
                src="/assets/images/pepefi/mandate-hero.svg"
                alt="A trading path inside a session boundary, stopped at the per-trade cap"
                sx={{
                  width: '100%', height: '100%',
                  borderRadius: '16px',
                  objectFit: 'contain',
                  bgcolor: '#0f1410',
                  border: '2px solid var(--palette-primary-main)',
                  boxShadow: '0 0 48px rgba(124,193,74,0.35)',
                  position: 'relative', zIndex: 1,
                }}
              />
            </Box>
          </Stack>
        </Box>

        {/* ── Live on-chain KPI strip ── */}
        <HeroKpiStrip />

        <Stack alignItems="center" spacing={2} sx={{ mb: 4 }}>
          <PaperTradingBadge />

          {/* Testnet badge */}
          <Chip
            label="Live on Base Sepolia · 84532"
            variant="outlined"
            color="success"
            icon={
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  animation: 'pulse 1.5s infinite',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(0.8)', opacity: 0.5 },
                    '50%': { transform: 'scale(1.2)', opacity: 1 },
                    '100%': { transform: 'scale(0.8)', opacity: 0.5 },
                  },
                }}
              />
            }
            sx={{
              mb: 4,
              borderColor: 'rgba(34, 197, 94, 0.24)',
              bgcolor: 'rgba(34, 197, 94, 0.08)',
              color: '#22c55e',
              px: 2,
              py: 1,
              fontSize: '0.95rem',
              fontWeight: 'bold',
            }}
          />

          {/* CTA */}
          <WalletButton wallet={wallet} />
          {wallet.error && (
            <Typography variant="caption" color="error" sx={{ mt: 1.5 }}>
              {wallet.error}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.8, fontSize: '0.95rem' }}>
            {t.landing.connectHint}
          </Typography>
        </Stack>

        {/* ── What is Paper Trading? ── */}
        <Box sx={{ py: 5, textAlign: 'center' }}>
          {/* component="h2" while keeping the h4 look. The outline ran
              h1 -> h4 -> h6, so anyone navigating by heading in a screen reader
              got two phantom levels and no sense of the page structure.
              `variant` is the type scale, `component` is the semantics — they
              do not have to match, and here they should not. */}
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 1.5 }}>
            {t.landing.paperTrading.title}
          </Typography>
          <Typography
            variant="body1"
            sx={{ maxWidth: 680, mx: 'auto', color: 'text.secondary', lineHeight: 1.9 }}
          >
            {t.landing.markup.paperBefore}<b>{t.landing.markup.paperBold1}</b>{t.landing.markup.paperMid}<b>{t.landing.markup.paperBold2}</b>{t.landing.markup.paperAfter}
          </Typography>
        </Box>

        {/* ── Divider ── */}
        <Divider sx={{ my: 6, opacity: 0.15 }} />

        {/* ── 幣股金債四個對照指數 ──
            這塊本來只有登入後、進到 /portfolio 才看得到，但平台最想被記住的
            一句話（「這裡配置的是股債金幣，不是只有幣」）正是它在講的。
            BenchmarkStrip 不吃任何持倉 props、自己打 signal-api，所以沒連錢包
            的訪客也照樣看到即時數字。 */}
        {/* 沒有公開的 signal-api（GitHub Pages 評審版）時整塊不顯示，而不是露出連線錯誤。 */}
        {SIGNAL_API_AVAILABLE && (
          <>
            <Box sx={{ mb: 6 }}>
              <Typography variant="overline" component="h2" color="text.secondary" align="center" display="block" sx={{ mb: 3, fontWeight: 'bold', letterSpacing: 3, fontSize: '1rem' }}>
                {t.portfolio.allocation.benchmark.heading}
              </Typography>
              <Card sx={{ p: { xs: 2.5, sm: 3.5 }, border: '1px solid', borderColor: 'divider' }}>
                <BenchmarkStrip />
              </Card>
            </Box>

            {/* ── Divider ── */}
            <Divider sx={{ my: 6, opacity: 0.15 }} />
          </>
        )}

        {/* ── Features ── */}
        <Box sx={{ mb: 6 }}>
          {/* Was a plain overline — visually a section heading, semantically
              nothing, so the six feature cards below had no parent in the
              outline. */}
          <Typography variant="overline" component="h2" color="text.secondary" align="center" display="block" sx={{ mb: 3.5, fontWeight: 'bold', letterSpacing: 3, fontSize: '1rem' }}>
            {t.landing.features.heading}
          </Typography>
          <Grid container spacing={2.5}>
            {VISIBLE_FEATURES.map((f) => (
              <Grid size={{ xs: 12, sm: 6 }} key={f.title}>
                <Card
                  sx={{
                    p: 3.5,
                    height: '100%',
                    bgcolor: 'rgba(255,255,255,0.01)',
                    borderColor: 'rgba(255,255,255,0.05)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: 'rgba(124, 193, 74, 0.03)',
                      borderColor: 'var(--palette-primary-main)',
                      boxShadow: '0 12px 24px rgba(124, 193, 74, 0.12)',
                      transform: 'translateY(-6px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      mb: 2.5,
                      display: 'flex',
                      height: 48,
                      width: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1.5,
                      bgcolor: 'rgba(124, 193, 74, 0.1)',
                      color: 'primary.main',
                    }}
                  >
                    <Iconify icon={f.icon} width={26} />
                  </Box>
                  {/* subtitle1 renders as h6 by default — an h6 directly under
                      an h2 is a two-level jump. h3 is the correct child. */}
                  <Typography variant="subtitle1" component="h3" sx={{ color: 'text.primary', fontWeight: 'bold', mb: 1.5, fontSize: '1.2rem' }}>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, fontSize: '1rem' }}>
                    {f.desc}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* ── How to Start ── */}
        <Box sx={{ mb: 4 }}>
          <Card
            sx={{
              p: 4,
              bgcolor: 'rgba(124, 193, 74, 0.02)',
              borderColor: 'rgba(124, 193, 74, 0.15)',
              boxShadow: '0 8px 32px 0 rgba(124, 193, 74, 0.05)',
              border: '1px solid rgba(124, 193, 74, 0.2)',
              position: 'relative',
              overflow: 'hidden',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                background: 'linear-gradient(90deg, var(--palette-primary-main), var(--palette-secondary-main))',
              }
            }}
          >
            <Typography variant="overline" component="h2" color="primary" display="block" sx={{ mb: 3, fontWeight: 'bold', letterSpacing: 2.5, fontSize: '1.1rem' }}>
              {t.landing.steps.heading}
            </Typography>
            <Stack spacing={3}>
              {STEPS.map((s) => (
                <Box key={s.n} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      height: 32,
                      width: 32,
                      flexShrink: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      bgcolor: 'rgba(124, 193, 74, 0.15)',
                      border: '1px solid',
                      borderColor: 'rgba(124, 193, 74, 0.4)',
                      color: 'primary.main',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {s.n}
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', pt: 0.4, lineHeight: 1.6, fontSize: '1.05rem' }}>
                    {s.text}
                  </Typography>
                </Box>
              ))}
            </Stack>

            {/* Quick links */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              {([
                { label: 'Exchange',    icon: 'solar:transfer-horizontal-bold-duotone', to: '/exchange' },
                { label: 'Marketplace', icon: 'solar:cart-3-bold',                      to: '/marketplace' },
                { label: 'Vault',       icon: 'solar:shield-keyhole-bold-duotone',      to: '/vault' },
              ] as const).map((link) => (
                <Button
                  key={link.label}
                  component={RouterLink}
                  to={link.to}
                  variant="outlined"
                  size="medium"
                  color="inherit"
                  startIcon={<Iconify icon={link.icon} width={18} />}
                  sx={{
                    borderRadius: 1,
                    textTransform: 'none',
                    borderColor: 'divider',
                    color: 'text.secondary',
                    fontSize: '0.95rem',
                    px: 2.5,
                    '&:hover': {
                      borderColor: 'text.primary',
                      color: 'text.primary',
                      bgcolor: 'rgba(255,255,255,0.03)',
                    },
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Box>
          </Card>

          {/* A real disclosure about who controls the price feed, previously set
              in caption size at opacity 0.6 — dimmed to roughly 2.5:1 against
              the panel, i.e. below the 4.5:1 floor, and read as decoration. If
              a venue is telling you an admin key moves the oracle, that has to
              be legible. Same words, no longer whispered. */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            justifyContent="center"
            sx={{ mt: 2.5, color: 'warning.main' }}
          >
            <Iconify icon="solar:danger-triangle-bold" width={18} sx={{ mt: '1px', flexShrink: 0 }} />
            <Typography variant="body2" align="center" sx={{ fontSize: '0.875rem' }}>
              {t.landing.oracleDisclosure}
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
