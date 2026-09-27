/**
 * Design tokens (docs/design.md). PLACEHOLDER VALUES: these are the colours the
 * pre-restructure UI already used, kept neutral until the design mockups are
 * approved. Change values here only; components use the role names.
 * CommonJS on purpose: Tailwind and NativeWind configs `require()` it.
 */
module.exports = {
  colors: {
    canvas: '#FFFFFF', // page background
    surface: '#F5F5F4', // cards, panels
    ink: '#171717', // main text
    'ink-muted': '#737373', // secondary text
    line: '#E5E5E5', // borders, dividers
    brand: '#171717', // IWC brand colour (placeholder until the logo/brand is designed)
    region: '#695E4F', // fallback for a region's accent; real value comes from regions.accent_color
    positive: '#15803D',
    caution: '#A16207',
    danger: '#B91C1C',
  },
  radius: { sm: '4px', md: '8px', lg: '12px' },
  duration: { fast: '120ms', base: '200ms', slow: '320ms' },
};
