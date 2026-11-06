/**
 * The founder's own photos for Home's category tiles (founder 2026-11-03: "I want to update the categories photos"). To
 * set one: put the file in apps/web/public/visuals/ (JPEG, WebP or AVIF; square or near it,
 * about 800 × 800: the tile is square and crops to fill) and write its path beside the category, e.g.
 * 'sweets': '/visuals/sweets.jpg'. Left null, a tile shows its category's newest piece (D-187).
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
  'papad-and-wadi': '/visuals/papad-and-wadi.jpg',
  // Home & gifts; Gifts is the whole of Home & gifts, no category of its own (D-190)
  'pooja-and-spiritual': '/visuals/pooja-and-spiritual.jpg',
  'handicrafts-and-decor': '/visuals/handicrafts-and-decor.jpg',
  'thaali-and-serveware': null,
  gifts: null,
  // Clothing (D-190); Shirts and Tops share a category, so their keys name who they are for
  'shirts-and-tops:men': null,
  'shirts-and-tops:women': null,
  'jeans-and-trousers': null,
  'co-ords-and-dresses': null,
  'kurtas:women': null,
  sarees: null,
};
