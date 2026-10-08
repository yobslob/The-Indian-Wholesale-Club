const { platformSelect } = require('nativewind/theme');

/**
 * Font roles for the app (docs/design.md). Native fonts are one weight per family, so weights are separate
 * classes (font-ui-semibold, …) instead of font-semibold. The family names are the ones lib/fonts.ts loads (D-079,
 * D-080): Cinzel, Syne, Karla; Georgia (built into iOS; Gelasio on Android) for the logo text only.
 */
// nativewind/theme picks its native platformSelect whenever NATIVEWIND_OS is set, "web" included, and that
// output is not CSS; the web preview gets a plain font stack instead.
const isWeb = !process.env.NATIVEWIND_OS || process.env.NATIVEWIND_OS === 'web';
const select = ({ web, ...native }) => (isWeb ? web : [platformSelect(native)]);

const fonts = {
  display: ['Cinzel_400Regular'], // the Home name, state names, product titles, the origin line, stamps (D-079)
  'display-medium': ['Cinzel_500Medium'],
  heading: ['Syne_500Medium'], // page and section headings (D-080)
  'heading-semibold': ['Syne_600SemiBold'],
  body: ['Karla_400Regular'],
  'body-medium': ['Karla_500Medium'],
  'body-semibold': ['Karla_600SemiBold'],
  ui: ['Karla_500Medium'],
  'ui-semibold': ['Karla_600SemiBold'],
  foot: ['Karla_400Regular'],
  logo: select({ ios: 'Georgia', android: 'Gelasio_400Regular', default: 'Gelasio_400Regular', web: ['Georgia', 'Gelasio_400Regular'] }), // the logo text only (D-077)
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './features/**/*.{js,ts,jsx,tsx}',
  ],
  // Design tokens only (docs/design.md): bg-canvas, text-ink, border-line, bg-brand, …
  presets: [require('nativewind/preset'), require('@repo/tokens/preset')],
  theme: { extend: { fontFamily: fonts } },
  plugins: [],
};
