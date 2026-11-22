import { kitLead } from '@repo/shared/domain';

import type { SlotId } from '@/features/visuals/slots';
import type { HomeRecipe } from '@repo/db/store';

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
export type Art = 'kurta' | 'cone' | 'india' | 'kadai';

export interface Arch {
  id: string;
  /** The small line over the hook. */
  kicker: string;
  /** "starting from" above a big price, or null for a hook that is all words. */
  lead: string | null;
  /** The words of a hook that is all words. */
  big: string;
  /** D-197: the price under "starting from", in US cents, drawn in the visitor's dollars. */
  cents?: number;
  href: string;
  tone: Tone;
  art: Art;
  /** The window's button (D-176): where it goes is the window's own link. */
  cta: string;
  /** A paper chit hung under the price. */
  tag?: string;
  /** The founder's photo for the window's top (slots.ts); the drawing shows while it is empty. */
  slot: SlotId;
  /** D-203, Cook at home: the main window (wider, taller, a filled button) and what only it carries. */
  recipe?: {
    /** The dish photo (R2), before the slot. */
    photo: string | null;
    name: string;
    /** "<one line> · <state>", under the photo on wide screens. */
    line: string;
    /** The whole window's name for screen readers, with the kit price drawn in. */
    label: string;
  };
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
  /** A cap, written in US dollars in every country (D-198). */
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
    cents: 1145,
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
    cents: 39,
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

/**
 * D-203 (founder 2026-11-23: "clothing window on the left, snacks window on the right … whatever you design of this will
 * be in the middle"; "middle one is the main one"; the words approved as drafted): with a live recipe pinned to Home,
 * Cook at home takes the middle and Get snacks from your neighbourhood leaves the row. Without one, today's windows
 * (ship dark).
 */
export function archesFor(recipe: HomeRecipe | null): readonly Arch[] {
  if (!recipe) return ARCHES;
  const [clothing, snacks] = ARCHES as [Arch, Arch, Arch];
  const cook: Arch = {
    id: 'recipe',
    kicker: 'Cook at home',
    lead: kitLead(recipe.name),
    big: '',
    cents: recipe.kit_cents,
    href: `/recipes/${recipe.slug}`,
    cta: 'Get the recipe',
    tone: 'paper',
    art: 'kadai',
    tag: "Recipe's on us.",
    slot: 'homecoming-recipes',
    recipe: {
      photo: recipe.photo_path,
      name: recipe.name,
      line: [recipe.blurb, recipe.region_name ?? 'All of India'].filter(Boolean).join(' · '),
      label: `Cook ${recipe.name.toLowerCase()} at home: recipe and kit`,
    },
  };
  return [clothing, cook, snacks];
}
