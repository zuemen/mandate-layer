import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

export type LogoProps = LinkProps & {
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = true,
  ...other
}: LogoProps) {
  const pepeImg = (size: number) => (
    <Box
      component="img"
      src="/logo/mandate-mark.svg"
      alt="Mandate Layer"
      sx={{
        width: size,
        height: size,
        borderRadius: '8px',
        boxShadow: '0 0 8px rgba(124,193,74,0.35)',
        flexShrink: 0,
      }}
    />
  );

  const singleLogo = pepeImg(36);

  const fullLogo = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {pepeImg(32)}
      <Typography
        component="span"
        sx={{
          fontWeight: 900,
          fontSize: '1.15rem',
          color: 'var(--palette-primary-main)',
          lineHeight: 1,
          letterSpacing: '-0.5px',
          whiteSpace: 'nowrap',
        }}
      >
        Mandate Layer
      </Typography>
    </Box>
  );

  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="Logo"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: 40,
          height: 40,
          ...(!isSingle && { width: 120, height: 36 }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {isSingle ? singleLogo : fullLogo}
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
  alignItems: 'center',
}));
