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
   * Font roles (D-079, D-080, D-096). Family names only: the web maps them to its self-hosted fonts
   * (apps/web/app/fonts.ts), the app to the fonts it bundles (apps/app/lib/fonts.ts).
   */
  fonts: {
    display: ['Cinzel', 'Georgia', 'serif'], // the Home name, state names, product titles, the origin line, stamps
    heading: ['Syne', 'system-ui', 'sans-serif'], // page and section headings below the hero (D-080)
    body: ['Karla', 'system-ui', 'sans-serif'], // paragraphs
    ui: ['Karla', 'system-ui', 'sans-serif'], // navigation, buttons, labels, prices, product names on cards
    foot: ['Karla', 'system-ui', 'sans-serif'], // the footer
    logo: ['Georgia', 'Gelasio', 'Times New Roman', 'serif'], // the logo text only (D-077's India mark is fitted to Georgia)
  },
};