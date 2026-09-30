const { platformSelect } = require('nativewind/theme');

/**
 * Font roles for the app (docs/design.md). Native fonts are one weight per family, so weights are separate
 * classes (font-ui-semibold, …) instead of font-semibold. The family names are the ones lib/fonts.ts loads;
 * iOS has Helvetica Neue and Georgia built in, Android uses TeX Gyre Heros and Gelasio.
 */
// nativewind/theme picks its native platformSelect whenever NATIVEWIND_OS is set, "web" included, and that
// output is not CSS; the web preview gets a plain font stack instead.
const isWeb = !process.env.NATIVEWIND_OS || process.env.NATIVEWIND_OS === 'web';
const select = ({ web, ...native }) => (isWeb ? web : [platformSelect(native)]);

const fonts = {
  hero: select({ ios: 'HelveticaNeue-Medium', android: 'TeXGyreHeros', default: 'TeXGyreHeros', web: ['Helvetica Neue', 'TeXGyreHeros', 'Arial'] }),
  display: select({ ios: 'Georgia', android: 'Gelasio_400Regular', default: 'Gelasio_400Regular', web: ['Georgia', 'Gelasio_400Regular'] }),
  'display-italic': select({
    ios: 'Georgia-Italic',
    android: 'Gelasio_400Regular_Italic',
    default: 'Gelasio_400Regular_Italic',
    web: ['Georgia', 'Gelasio_400Regular_Italic'],
  }),
  body: ['Poppins_400Regular'],
  'body-medium': ['Poppins_500Medium'],
  'body-semibold': ['Poppins_600SemiBold'],
  ui: ['Montserrat_500Medium'],
  'ui-semibold': ['Montserrat_600SemiBold'],
  foot: ['Inter_400Regular'],
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
