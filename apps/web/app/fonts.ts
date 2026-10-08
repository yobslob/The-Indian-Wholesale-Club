import localFont from 'next/font/local';

/**
 * The approved fonts (D-079, D-080), self-hosted from app/fonts (PR-6). The files are committed, Latin subset only (see
 * app/fonts/README.md), so neither `next dev` nor `next build` fetches anything from Google: a network that is served
 * different Google Fonts CSS broke Turbopack's dev server (2026-10-06).
 * Cinzel: the Home name, state names, product titles. Syne: page and section headings. Karla: everything else.
 * Georgia stays for the logo text only (D-077); Gelasio is its free look-alike and is not preloaded, so a browser only
 * downloads it where Georgia is missing.
 */
export const displayFont = localFont({
  src: './fonts/cinzel-latin-variable.woff2',
  weight: '400 500',
  variable: '--font-display',
  display: 'swap',
});

export const headingFont = localFont({
  src: './fonts/syne-latin-variable.woff2',
  weight: '500 600',
  variable: '--font-heading',
  display: 'swap',
});

export const textFont = localFont({
  src: './fonts/karla-latin-variable.woff2',
  weight: '400 700',
  variable: '--font-text',
  display: 'swap',
});

export const georgiaFallback = localFont({
  src: './fonts/gelasio-latin-400.woff2',
  weight: '400',
  variable: '--font-gelasio',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
});

export const fontVariables = [displayFont, headingFont, textFont, georgiaFallback].map((font) => font.variable).join(' ');
