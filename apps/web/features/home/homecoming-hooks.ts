import type { SlotId } from '@/features/visuals/slots';

/**
 * Home's season: the windows' words and where each opens. The season is Homecoming, for Thanksgiving (founder
 * 2026-11-10, D-196: "change my theme from diwali to homecoming … change the theme to thanksgiving"); before it, Diwali
 * (founder 2026-10-31, D-174: "creative hooks like Host your Diwali under $99, Clothing starting from $19, snacks
 * starting from $0.99, Get snacks from your neighbourhood, Sorry for being this good"; then "clothing starting from
 * $11.45 and snacks starting from $0.39", D-175). The founder's words and prices, used as given (D-012), with the
 * festival's name swapped: change them here. Each window has one photo slot (slots.ts, D-175). Each "from" opens its See
 * all page. To change the season: SEASON and WIDE here, the drawings in homecoming-art.tsx, the colours under `.hc` in
 * globals.css, the hero's words in hero-words.ts and the photos in slots.ts.
 */

export type Tone = 'pumpkin' | 'olive' | 'paper';
export type Art = 'kurta' | 'cone' | 'india';

export interface Arch {
  id: string;
  /** The small line over the hook. */
  kicker: string;
  /** "starting from" above a big price, or null for a hook that is all words. */
  lead: string | null;
  /** The words of a hook that is all words. */
  big: string;
  href: string;
  tone: Tone;
  art: Art;
  /** The window's button (D-176): where it goes is the window's own link. */
  cta: string;
  /** A paper chit hung under the price. */
  tag?: string;
  /** The founder's photo for the window's top (slots.ts); the drawing shows while it is empty. */
  slot: SlotId;
}

export const SEASON = {
  /** The day's name, before its date on the hero and the dusk card. */
  name: 'Thanksgiving',
  /** Thanksgiving 2026, the fourth Thursday of November; null takes the date off both. */
  day: '2026-11-26' as string | null,
  /** The sections' names for screen readers. */
  arches: 'Shop for Thanksgiving',
  wide: 'Homecoming at IWC',
} as const;

export const WIDE = {
  /** The founder's hook (D-174) with the festival's name swapped (D-196, Claude's draft, D-019). */
  hook: 'Host your Thanksgiving under $99.',
  /** The hook's other side (founder 2026-11-07), turning over with it. */
  flip: 'Get 10% off on your first order.',
  cta: 'Shop under $99',
  href: '/home-and-gifts?max=99',
  slot: 'homecoming-table' as const satisfies SlotId,
};

export const ARCHES: readonly Arch[] = [
  {
    id: 'clothing',
    kicker: 'Clothing',
    lead: 'starting from',
    big: '$11.45',
    href: '/clothing',
    cta: 'Shop clothing',
    tone: 'pumpkin',
    art: 'kurta',
    slot: 'homecoming-clothing',
  },
  {
    id: 'snacks',
    kicker: 'Snacks',
    lead: 'starting from',
    big: '$0.39',
    href: '/food?category=snacks-and-namkeen',
    cta: 'Shop snacks',
    tone: 'olive',
    art: 'cone',
    tag: 'Sorry for being this good.',
    slot: 'homecoming-snacks',
  },
  {
    id: 'nearby',
    kicker: 'Pick your state',
    lead: null,
    big: 'Get snacks from your neighbourhood',
    href: '#pick',
    cta: 'Find your state',
    tone: 'paper',
    art: 'india',
    slot: 'homecoming-nearby',
  },
];
