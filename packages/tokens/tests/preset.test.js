const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const tokens = require('../tokens');
const preset = require('../preset');

// Colour keys of the pre-restructure Tailwind configs (apps/web, apps/app). Token
// names must not collide with them until R5/R6 remove the old theme.
const LEGACY_COLOR_KEYS = ['primary', 'secondary', 'accent', 'destructive', 'success', 'warning', 'info', 'muted',
  'neutral', 'border', 'input', 'ring', 'background', 'foreground'];

/** WCAG 2.2 contrast ratio of two #RRGGBB colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('@repo/tokens', () => {
  it('every colour is a 6-digit hex value', () => {
    for (const [name, value] of Object.entries(tokens.colors)) assert.match(value, /^#[0-9A-F]{6}$/i, name);
  });

  it('the Tailwind preset exposes every token', () => {
    assert.deepEqual(preset.theme.extend.colors, tokens.colors);
    assert.deepEqual(preset.theme.extend.borderRadius, tokens.radius);
    assert.deepEqual(preset.theme.extend.transitionDuration, tokens.duration);
    assert.deepEqual(preset.theme.extend.fontFamily, tokens.fonts);
  });

  it('token names do not collide with the legacy theme', () => {
    for (const name of Object.keys(tokens.colors)) assert.ok(!LEGACY_COLOR_KEYS.includes(name), name);
  });

  // design.md §Accessibility: WCAG 2.2 AA (4.5 : 1) for every text colour on every background it sits on.
  it('text colours meet WCAG AA on the page backgrounds', () => {
    const text = ['ink', 'ink-muted', 'brand', 'region', 'positive', 'caution', 'danger'];
    for (const fg of text) {
      for (const bg of ['canvas', 'surface', 'paper']) {
        const ratio = contrast(tokens.colors[fg], tokens.colors[bg]);
        assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}`);
      }
    }
    assert.ok(contrast(tokens.colors['on-brand'], tokens.colors.brand) >= 4.5, 'on-brand on brand');
  });
});
