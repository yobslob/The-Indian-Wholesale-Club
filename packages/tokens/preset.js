/** Tailwind preset used by apps/web and apps/app (NativeWind). Classes: bg-canvas, text-ink, font-hero, rounded-pill, … */
const tokens = require('./tokens');

module.exports = {
  theme: {
    extend: {
      colors: { ...tokens.colors },
      borderRadius: { ...tokens.radius },
      transitionDuration: { ...tokens.duration },
      fontFamily: { ...tokens.fonts },
    },
  },
};
