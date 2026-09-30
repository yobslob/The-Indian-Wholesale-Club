/**
 * Design tokens (docs/design.md). Final values from the approved mockup (C1, D-050 – D-055,
 * design/mockups/a-gallery.html). Components use the role names, never raw hex.
 * CommonJS on purpose: Tailwind and NativeWind configs `require()` it.
 */
module.exports = {
  colors: {
    canvas: '#F4EFE6', // page background (warm ivory)
    surface: '#EBE4D8', // panels, cards
    paper: '#FBF8F3', // pills, inputs, the lightest layer
    ink: '#1E1B16', // main text
    'ink-muted': '#665E53', // secondary text (AA on canvas, surface and paper)
    line: '#D9D0C1', // borders, dividers
    brand: '#7A2E23', // IWC brand colour: primary buttons, the map's "open now" key
    'on-brand': '#FFFFFF', // text on brand
    region: '#7A2E23', // fallback for a region's accent; the real value comes from regions.accent_color
    land: '#E0D6C4', // the India map's regions that are not open yet
    positive: '#166534',
    caution: '#8A5A00',
    danger: '#B91C1C',
  },
  radius: { sm: '6px', md: '16px', lg: '22px', pill: '999px' },
  duration: { fast: '120ms', base: '200ms', slow: '320ms' },
  /**
   * Font roles (D-050 – D-052). Family names only: the web maps them to its self-hosted fonts
   * (apps/web/app/fonts.ts), the app to the fonts it bundles.
   */
  fonts: {
    hero: ['Helvetica Neue', 'Helvetica', 'TeX Gyre Heros', 'Arial', 'sans-serif'], // hero + section headings
    display: ['Georgia', 'Gelasio', 'Times New Roman', 'serif'], // logo, product title, origin line
    body: ['Poppins', 'system-ui', 'sans-serif'], // paragraphs
    ui: ['Montserrat', 'system-ui', 'sans-serif'], // navigation, buttons, labels, product names on cards
    foot: ['Inter', 'system-ui', 'sans-serif'], // the footer only
  },
};
