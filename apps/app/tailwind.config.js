/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  // IWC design tokens (bg-canvas, text-ink, …): docs/design.md. The legacy colours below go in R6.
  presets: [require('nativewind/preset'), require('@repo/tokens/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#171717',
          foreground: '#FAFAFA',
          hover: '#262626',
        },
        secondary: {
          DEFAULT: '#F5F5F4',
          foreground: '#1C1917',
          hover: '#E7E5E4',
        },
        accent: {
          DEFAULT: '#695E4F',
          foreground: '#FFFFFF',
          hover: '#574D41',
        },
        destructive: {
          DEFAULT: '#B91C1C',
          foreground: '#FEF2F2',
        },
        success: {
          DEFAULT: '#15803D',
          foreground: '#F0FDF4',
        },
        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#737373',
        },
      },
    },
  },
  plugins: [],
};
