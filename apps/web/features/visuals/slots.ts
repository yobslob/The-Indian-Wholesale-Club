/**
 * The pictures the founder fills in (founder 2026-10-30: "You don't have to generate images just leave a placeholder
 * there and I will fill."). To fill one: put the file in apps/web/public/visuals/ (AVIF, WebP or JPEG) and set its `src`
 * ("/visuals/seven-day-hero.jpg"), `alt`, and its width and height (the photo's own, so it is not cropped; the wide
 * posters keep 3:1 and show the middle of a taller photo). The founder's photos fill Page not found and the empty bag
 * (2026-10-31; the 7-day, Home and Sign in photos taken out again the same day). Until then the slot shows a labelled frame on local and
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
  // Founder 2026-10-31 ("think creatively of what we can put in the whitespaces available"): the empty side of pages
  // that hold one narrow column on a wide screen. Wide screens only (picture-beside.tsx); phones have no room to spare.
  'sign-in': {
    src: null,
    alt: '',
    width: 1000,
    height: 1250,
    brief: 'Beside Sign in and Create an account: a brass diya and a pair of chappals at a front door, evening light.',
  },
  about: {
    src: null,
    alt: '',
    width: 1000,
    height: 1250,
    brief: 'Beside About us: a family at a table opening a parcel from home, sweets and a kurta coming out of it.',
  },
  'how-it-works': {
    src: null,
    alt: '',
    width: 1000,
    height: 1250,
    brief: 'Beside How it works: a parcel at a US front door, opened, tissue paper and a box of mithai on top.',
  },
  contact: {
    src: null,
    alt: '',
    width: 1000,
    height: 1000,
    brief: 'Beside Contact: a cup of chai in a glass and a phone on a wooden table, morning light.',
  },
  'empty-bag': {
    src: '/visuals/empty-bag.jpg',
    alt: 'Jhumkas, gold bangles, a hair clip and rupee notes laid out on a pair of jeans.',
    width: 736,
    height: 981,
    brief: 'Beside an empty bag: an empty steel thali with its katoris on a table, waiting to be filled.',
  },
  'not-found': {
    src: '/visuals/not-found.jpg',
    alt: 'Embroidered lehengas and festive outfits hanging on a rail in a boutique.',
    width: 736,
    height: 1308,
    brief: 'Beside Page not found: an empty auto-rickshaw parked in a quiet lane, nobody around. Lost, but calm.',
  },
} satisfies Record<string, Slot>;

export type SlotId = keyof typeof SLOTS;
