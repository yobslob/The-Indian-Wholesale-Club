/**
 * The pictures the founder fills in (founder 2026-10-30: "You don't have to generate images just leave a placeholder
 * there and I will fill."). To fill one: put the file in apps/web/public/visuals/ (AVIF, WebP or JPEG) and set its `src`
 * ("/visuals/empty-bag.jpg"), `alt`, and its width and height (the photo's own, so it is not cropped). The founder's
 * photos fill Page not found, the empty bag and Home's season windows. A slot comes back when it has its photo (§10 Y-8):
 * an empty one shows a labelled frame on local and preview builds and nothing at all on the live site.
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
  // Founder 2026-10-31 ("think creatively of what we can put in the whitespaces available"): the empty side of pages
  // that hold one narrow column on a wide screen. Wide screens only (picture-beside.tsx); phones have no room to spare.
  'empty-bag': {
    src: '/visuals/empty-bag.jpg',
    alt: 'Jhumkas, gold bangles, a hair clip and rupee notes laid out on a pair of jeans.',
    width: 736,
    height: 981,
    brief: 'Beside an empty bag: an empty steel thali with its katoris on a table, waiting to be filled.',
  },
  // D-175 (founder 2026-10-31: "Leave image placeholders in it where I can Insert my photos one photo per card"): the
  // season windows on Home (homecoming-windows.tsx), the founder's photos since 2026-10-31. Cropped to fill; while empty
  // the window shows its drawing. D-196: the season is Homecoming; the files are still the Diwali ones (their names
  // too) until the founder gives new ones, and `homecoming-snacks` still shows diyas.
  'homecoming-table': {
    src: '/visuals/diwali-night.jpg',
    alt: 'Two friends laughing at a dinner table, one feeding the other a sweet.',
    width: 1080,
    height: 1350,
    brief:
      'The wide window: family or friends round a full table at dusk, a homecoming dinner. Fills the card\'s right side, fading into the wine on its left and bottom (keep the subject right of centre).',
  },
  'homecoming-clothing': {
    src: '/visuals/diwali-clothing.jpg',
    alt: 'A woman in gold and silver glass bangles, her wrists crossed over her eyes.',
    width: 736,
    height: 970,
    brief:
      'The Clothing arch: a kurta or saree up close, or someone wearing one, warm light. Fills the arch\'s top, its bottom fading into pumpkin.',
  },
  'homecoming-snacks': {
    src: '/visuals/diwali-snacks.jpg',
    alt: 'Lit diyas round a bowl of flowers, with plates of kaju katli, namkeen and chocolates.',
    width: 736,
    height: 1275,
    brief:
      'The Snacks arch: namkeen, bhujia or chips spilling on a table, or a paper cone of bhel. Fills the arch\'s top, fading into green.',
  },
  'homecoming-nearby': {
    src: '/visuals/snacks-nearby.jpg',
    alt: 'A packet of Maggi masala noodles beside a steaming bowl of them.',
    width: 1200,
    height: 1499,
    brief:
      'The neighbourhood arch: a small kirana shop front or a mohalla lane at dusk. Fills the arch\'s top, fading into cream.',
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
