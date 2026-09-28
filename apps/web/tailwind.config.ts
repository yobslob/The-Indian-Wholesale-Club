import tokens from '@repo/tokens';

import type { Config } from 'tailwindcss';

const config = {
  // Design tokens only (docs/design.md): bg-canvas, text-ink, border-line, bg-brand, …
  presets: [require('@repo/tokens/preset')],
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // A region page sets --region-accent from regions.accent_color (design.md §Visual system 2).
        region: `var(--region-accent, ${tokens.colors.region})`,
      },
    },
  },
} satisfies Config;

export default config;
