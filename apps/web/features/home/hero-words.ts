/**
 * Home hero's words (D-183, founder 2026-11-04: "think of something creative something out of the box, use the power of
 * vocabulary, some CTA for the 7-day store showing $49.99"; D-184: the Diwali date over them; D-185: the button is the
 * free line). Claude's draft, kept by the founder ("rest is good"); change them here. The three words are what the 7-day
 * store sells (sweets, masalas and snacks from home) and what they bring back. The date, the days and the free line's
 * amount are not words: they come from diwali-hooks.ts and Settings (home-hero.tsx).
 */
export const HERO = {
  /** Read to screen readers before the date while the 7-day store is open, and the kicker once Diwali's date is gone. */
  store: 'The 7-day store',
  /** The kicker with no date while the 7-day store is closed (the poster then opens Food). */
  storeClosed: 'From all 36 states',
  /** One beat each, in Cormorant Garamond. */
  lines: ['Mithai.', 'Masala.'],
  /** The last beat, in its gold italic. */
  accent: 'Memories.',
  /** Followed by "<days> days." */
  when: 'From India to your door in',
  /** After the days, small, while the 7-day store is open: only food comes in 7 days and has the free line (D-186). */
  onFood: '(on food)',
  /** The button: its small top line, then "from <free line>". */
  free: 'Free delivery',
  /** The button while the 7-day store (and so its free line) is closed. */
  shop: 'Shop the store',
} as const;
