const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const tokens = require('../tokens');
const preset = require('../preset');

// Colour keys of the pre-restructure Tailwind configs (apps/web, apps/app). Token
// names must not collide with them until R5/R6 remove the old theme.
const LEGACY_COLOR_KEYS = ['primary', 'secondary', 'accent', 'destructive', 'success', 'warning', 'info', 'muted',
  'neutral', 'border', 'input', 'ring', 'background', 'foreground'];

describe('@repo/tokens', () => {
  it('every colour is a 6-digit hex value', () => {
    for (const [name, value] of Object.entries(tokens.colors)) assert.match(value, /^#[0-9A-F]{6}$/i, name);
  });

  it('the Tailwind preset exposes every token', () => {
    assert.deepEqual(preset.theme.extend.colors, tokens.colors);
    assert.deepEqual(preset.theme.extend.borderRadius, tokens.radius);
    assert.deepEqual(preset.theme.extend.transitionDuration, tokens.duration);
  });

  it('token names do not collide with the legacy theme', () => {
    for (const name of Object.keys(tokens.colors)) assert.ok(!LEGACY_COLOR_KEYS.includes(name), name);
  });
});
