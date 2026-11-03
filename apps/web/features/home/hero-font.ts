import localFont from 'next/font/local';

/**
 * The poster's type (D-185, the founder's list): Cormorant Garamond for the headline and "Indian Wholesale Club",
 * its italic for the gold word, Montserrat for every small word. Latin WOFF2 files as Google Fonts serves them, variable
 * weight 400 – 700, SIL Open Font License 1.1 (app/fonts/README.md). Declared here and not in app/fonts.ts so only Home
 * loads and preloads them.
 */
export const heroSerif = localFont({
  src: [
    { path: '../../app/fonts/cormorant-garamond-latin-variable.woff2', weight: '400 700', style: 'normal' },
    { path: '../../app/fonts/cormorant-garamond-italic-latin-variable.woff2', weight: '400 700', style: 'italic' },
  ],
  variable: '--font-hero-serif',
  display: 'swap',
});

export const heroSans = localFont({
  src: '../../app/fonts/montserrat-latin-variable.woff2',
  weight: '400 700',
  variable: '--font-hero-sans',
  display: 'swap',
});
