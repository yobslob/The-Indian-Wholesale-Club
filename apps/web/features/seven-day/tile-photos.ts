/**
 * The founder's own photos for the 7-day store's category tiles (founder 2026-11-03: "I want to update the categories
 * photos in 7 day store"). To set one: put the file in apps/web/public/visuals/ (JPEG, WebP or AVIF; square or near it,
 * about 800 × 800: the tile is square and crops to fill) and write its path beside the category, e.g.
 * 'sweets': '/visuals/seven-day-sweets.jpg'. Left null, a tile shows its category's newest piece, as before (D-154).
 * Every category the 7-day store has today is listed; a new one shows its newest piece until it is added here.
 */
export const TILE_PHOTOS: Record<string, string | null> = {
  // Food
  'snacks-and-namkeen': '/visuals/snacks-and-namkeen.jpg',
  sweets: null,
  'rice-flours-and-staples': '/visuals/rice-flours-and-staples.jpg',
  'masala-blends': '/visuals/masala-blends.jpg',
  'pickles-and-chutneys': '/visuals/pickles-and-chutneys.jpg',
  'whole-spices': '/visuals/whole-spices.jpg',
  'tea-and-drinks': '/visuals/tea-and-drinks.jpg',
  'ground-spices': null,
  'papad-and-wadi': '/visuals/papad-and-wadi.jpg',
  // Home & gifts
  'pooja-and-spiritual': '/visuals/pooja-and-spiritual.jpg',
  'handicrafts-and-decor': '/visuals/handicrafts-and-decor.jpg',
  'thaali-and-serveware': null,
};
