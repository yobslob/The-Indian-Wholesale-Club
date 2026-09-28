/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './features/**/*.{js,ts,jsx,tsx}',
  ],
  // Design tokens only (docs/design.md): bg-canvas, text-ink, border-line, bg-brand, …
  presets: [require('nativewind/preset'), require('@repo/tokens/preset')],
  plugins: [],
};
