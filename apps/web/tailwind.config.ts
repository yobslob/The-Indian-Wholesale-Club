import tokens from '@repo/tokens';

import type { Config } from 'tailwindcss';

const GENERIC = new Set(['serif', 'sans-serif', 'system-ui', 'monospace']);

/**
 * A font role from the tokens with the self-hosted font's CSS variable (app/fonts.ts) put in place of its name.
 * Family names are quoted; generic families must stay unquoted to keep working.
 */
const withVar = (role: keyof typeof tokens.fonts, name: string, variable: string): string[] =>
  tokens.fonts[role].map((family) =>
    family === name ? `var(${variable})` : GENERIC.has(family) ? family : `"${family}"`,
  );

const config = {
  // Design tokens only (docs/design.md): bg-canvas, text-ink, border-line, bg-brand, font-heading, …
  presets: [require('@repo/tokens/preset')],
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // A region page sets --region-accent from regions.accent_color (design.md §Visual system 2).
        region: `var(--region-accent, ${tokens.colors.region})`,
      },
      fontFamily: {
        display: withVar('display', 'Cinzel', '--font-display'),
        heading: withVar('heading', 'Syne', '--font-heading'),
        body: withVar('body', 'Karla', '--font-text'),
        ui: withVar('ui', 'Karla', '--font-text'),
        foot: withVar('foot', 'Karla', '--font-text'),
        logo: withVar('logo', 'Gelasio', '--font-gelasio'),
        sans: withVar('body', 'Karla', '--font-text'),
      },
    },
  },
} satisfies Config;

export default config;
