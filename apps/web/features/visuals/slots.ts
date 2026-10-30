/**
 * The pictures the founder fills in (founder 2026-10-30: "You don't have to generate images just leave a placeholder
 * there and I will fill."). To fill one: put the file in apps/web/public/visuals/ (AVIF or WebP, at the size given) and
 * set its `src` ("/visuals/seven-day-hero.avif") and `alt`. Until then the slot shows a labelled frame on local and
 * preview builds and nothing at all on the live site, so a customer never sees an empty box.
 */
export interface Slot {
  /** The file under public/, or null while the slot waits for its picture. */
  src: string | null;
  /** What the picture shows, for screen readers (empty for pure decoration). */
  alt: string;
  width: number;
  height: number;
  /** What the slot wants, shown on the placeholder. */
  brief: string;
}

export const SLOTS = {
  'seven-day-hero': {
    src: null,
    alt: '',
    width: 1200,
    height: 1500,
    brief:
      'An opened parcel on a kitchen counter: snacks, masala packs and sweets spilling out, morning light.',
  },
  'seven-day-poster': {
    src: null,
    alt: '',
    width: 2400,
    height: 800,
    brief:
      'A wide seasonal poster for the 7-day store (now: Diwali, diyas and mithai boxes). Swap it each season.',
  },
  'home-poster': {
    src: null,
    alt: '',
    width: 2400,
    height: 800,
    brief:
      'A wide picture for Home under Pick your home: a dining table set for a family meal, or a festival evening.',
  },
} satisfies Record<string, Slot>;

export type SlotId = keyof typeof SLOTS;
