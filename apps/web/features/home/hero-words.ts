/**
 * Home hero's words (D-183, founder 2026-11-04: "think of something creative something out of the box, use the power of
 * vocabulary"; D-184: the Diwali date over them; D-185: the button is the free line; D-187: delivery days). Claude's
 * draft, kept by the founder ("rest is good"); change them here. The three words are what the store sends fastest
 * (sweets, masalas and snacks from home) and what they bring back. The date, the days and the free line's amount are not
 * words: they come from diwali-hooks.ts and Settings (home-hero.tsx).
 */
export const HERO = {
  /** Read to screen readers before the date, and the kicker once Diwali's date is gone. */
  storeClosed: 'From all 36 states',
  /** One beat each, in Cormorant Garamond. */
  lines: ['Mithai.', 'Masala.'],
  /** The last beat, in its gold italic. */
  accent: 'Memories.',
  /** Followed by "<days> delivery days". */
  when: 'From India to your door in',
  /** After the days, small: only food comes in 7 (D-186). */
  onFood: '(on food)',
  /** The button: its small top line, then "from <free line>". */
  free: 'Free delivery',
  /** The button with no free line. */
  shop: 'Shop the store',
} as const;
