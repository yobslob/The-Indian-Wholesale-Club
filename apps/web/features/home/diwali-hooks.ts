import { FESTIVALS } from '@repo/shared/domain';

import type { SlotId } from '@/features/visuals/slots';

/**
 * The Diwali windows' words and where each opens (founder 2026-10-31, D-174: "creative hooks like Host your Diwali under
 * $99, Clothing starting from $19, snacks starting from $0.99, Get snacks from your neighbourhood, Sorry for being this
 * good"; then "clothing starting from $11.45 and snacks starting from $0.39", D-175). The founder's words and prices,
 * used as given (D-012): change them here. Each window has one photo slot (slots.ts, D-175). Each "from" opens its See all page,
 * which lists low to high (D-144), so a shopper sees the cheapest piece first. Seasonal: swap the wide window after Diwali.
 */

export type Tone = 'saffron' | 'peacock' | 'paper';
export type Art = 'kurta' | 'cone' | 'india';

export interface Arch {
  id: string;
  /** The small line over the hook. */
  kicker: string;
  /** "starting from" above a big price, or null for a hook that is all words. */
  lead: string | null;
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

const diwali = FESTIVALS.find((f) => f.name === 'Diwali');

export const WIDE = {
  /** Lakshmi Puja's real date (homesick.ts). */
  day: diwali?.day ?? null,
  hook: 'Host your Diwali under $99.',
  cta: 'Shop under $99',
  href: '/home-and-gifts?max=99',
  slot: 'diwali-night' satisfies SlotId,
};

export const ARCHES: readonly Arch[] = [
  {
    id: 'clothing',
    kicker: 'Clothing',
    lead: 'starting from',
    big: '$11.45',
    href: '/clothing',
    cta: 'Shop clothing',
    tone: 'saffron',
    art: 'kurta',
    slot: 'diwali-clothing',
  },
  {
    id: 'snacks',
    kicker: 'Snacks',
    lead: 'starting from',
    big: '$0.39',
    href: '/food?category=snacks-and-namkeen',
    cta: 'Shop snacks',
    tone: 'peacock',
    art: 'cone',
    tag: 'Sorry for being this good.',
    slot: 'diwali-snacks',
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
    slot: 'diwali-nearby',
  },
];
