/** Tailwind preset used by apps/web and apps/app (NativeWind). Classes: bg-canvas, text-ink, border-line, … */
const tokens = require('./tokens');

module.exports = {
  theme: {
    extend: {
      colors: { ...tokens.colors },
      borderRadius: { ...tokens.radius },
      transitionDuration: { ...tokens.duration },
    },
  },
};
