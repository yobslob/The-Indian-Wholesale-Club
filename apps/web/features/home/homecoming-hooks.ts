import type { SlotId } from '@/features/visuals/slots';

/**
 * Home's season: the dusk window's words and where it opens. The season is Homecoming, for Thanksgiving (founder
 * 2026-11-10, D-196: "change my theme from diwali to homecoming … change the theme to thanksgiving"); before it, Diwali
 * (founder 2026-10-31, D-174: "creative hooks like Host your Diwali under $99, Clothing starting from $19, snacks
 * starting from $0.99, Get snacks from your neighbourhood, Sorry for being this good"; then "clothing starting from
 * $11.45 and snacks starting from $0.39", D-175). The founder's words and prices, used as given (D-012), with the
 * festival's name swapped: change them here. The window has one photo slot (slots.ts, D-175). To change the season: SEASON and WIDE here, the drawings in homecoming-art.tsx, the colours under `.hc` in
 * globals.css, the hero's words in hero-words.ts and the photos in slots.ts.
 */

export const SEASON = {
  /** The day's name, before its date on the hero and the dusk card. */
  name: 'Thanksgiving',
  /** Thanksgiving 2026, the fourth Thursday of November; null takes the date off both. */
  day: '2026-11-26' as string | null,
  /** The section's name for screen readers. */
  wide: 'Homecoming at IWC',
} as const;

export const WIDE = {
  /** The founder's hook (D-174) with the festival's name swapped (D-196, Claude's draft, D-019). */
  hook: 'Host your Thanksgiving under $99.',
  /** The hook's other side (founder 2026-11-07), turning over with it; D-212: the founder's line, no number or % on it. */
  flip: 'Aapka Order, Gharwalo ka profit.',
  /** A cap, written in US dollars in every country (D-198). */
  cta: 'Shop under $99',
  href: '/home-and-gifts?max=99',
  slot: 'homecoming-table' as const satisfies SlotId,
};
