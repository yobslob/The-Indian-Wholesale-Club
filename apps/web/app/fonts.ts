import { Gelasio, Inter, Montserrat, Poppins } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * The founder's fonts (design.md §Direction, D-050 – D-052), self-hosted by next/font (PR-6).
 * Helvetica Neue and Georgia are system fonts; TeX Gyre Heros and Gelasio are their free look-alikes and
 * are not preloaded, so a browser only downloads them where the system font is missing. Inter is the
 * footer's only font, below the fold, so it is not preloaded either.
 */
export const bodyFont = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const uiFont = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});

export const footFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-foot',
  display: 'swap',
  preload: false,
});

export const georgiaFallback = Gelasio({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
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
