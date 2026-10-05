import localFont from 'next/font/local';

/**
 * The founder's fonts (design.md §Direction, D-050 – D-052), self-hosted from app/fonts (PR-6). The files are
 * committed, Latin subset only (see app/fonts/README.md), so neither `next dev` nor `next build` fetches anything from
 * Google: a network that is served different Google Fonts CSS broke Turbopack's dev server (2026-10-06).
 * Helvetica Neue and Georgia are system fonts; TeX Gyre Heros and Gelasio are their free look-alikes and are not
 * preloaded, so a browser only downloads them where the system font is missing. Inter is the footer's only font,
 * below the fold, so it is not preloaded either.
 */
export const bodyFont = localFont({
  src: [
    { path: './fonts/poppins-latin-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/poppins-latin-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/poppins-latin-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
});

export const uiFont = localFont({
  src: './fonts/montserrat-latin-variable.woff2',
  weight: '500 700',
  variable: '--font-ui',
  display: 'swap',
});

export const footFont = localFont({
  src: './fonts/inter-latin-variable.woff2',
  weight: '400 500',
  variable: '--font-foot',
  display: 'swap',
  preload: false,
});

export const georgiaFallback = localFont({
  src: [
    { path: './fonts/gelasio-latin-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/gelasio-latin-italic-400.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-gelasio',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

/** TeX Gyre Heros (GUST Font License), Latin subset: see app/fonts/README.md. */
export const helveticaFallback = localFont({
  src: './fonts/tex-gyre-heros-latin.woff',
  weight: '400',
  variable: '--font-heros',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

export const fontVariables = [bodyFont, uiFont, footFont, georgiaFallback, helveticaFallback]
  .map((font) => font.variable)
  .join(' ');
