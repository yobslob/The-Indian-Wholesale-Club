/**
 * Home hero's words (D-183, founder 2026-11-04: "think of something creative something out of the box, use the power of
 * vocabulary"; D-184: the festival's date over them; D-185: the button is the free line; D-187: delivery days). The
 * headline is Claude's draft for Thanksgiving (D-196, D-019; the founder turned down "Home is coming to dinner."; before
 * it "Mithai. Masala. Memories." through Diwali): the table's "pass the gravy", asked for the one thing an American
 * Thanksgiving table never has. Change it here. The date, the days and the free line's amount are not words: they come
 * from homecoming-hooks.ts and Settings (home-hero.tsx).
 */
export const HERO = {
  /** Read to screen readers before the date, and the kicker when the season has no date. */
  storeClosed: 'From all 36 states',
  /** One beat each, in Cormorant Garamond. */
  lines: ['Pass the'],
  /** The last beat, in its gold italic. */
  accent: 'achaar.',
  /** Followed by "<days> delivery days". */
  when: 'From India to your door in',
  /** After the days, small: only food comes in 7 (D-186). */
  onFood: '(on food)',
  /** The button: its small top line, then "from <free line>". */
  free: 'Free delivery',
  /** The button with no free line. */
  shop: 'Shop the store',
} as const;
