/**
 * The founder's own photos for Home's category tiles (founder 2026-11-03: "I want to update the categories photos"). To
 * set one: put the file in apps/web/public/visuals/ (JPEG, WebP or AVIF; square or near it,
 * about 800 × 800: the tile is square and crops to fill) and write its path beside the category, e.g.
 * 'sweets': '/visuals/sweets.jpg'. Left null, a tile shows its category's newest piece (D-187).
 */
export const TILE_PHOTOS: Record<string, string | null> = {
  // Food
  'snacks-and-namkeen': '/visuals/snacks-and-namkeen.jpg',
  'bakery-and-biscuits': null,
  sweets: '/visuals/sweets.jpg',
  'rice-flours-and-staples': '/visuals/rice-flours-and-staples.jpg',
  'masala-blends': '/visuals/masala-blends.jpg',
  'pickles-and-chutneys': '/visuals/pickles-and-chutneys.jpg',
  'whole-spices': '/visuals/whole-spices.jpg',
  'tea-and-drinks': '/visuals/tea-and-drinks.jpg',
  'papad-and-wadi': '/visuals/papad-and-wadi.jpg',
  // Home & gifts
  'pooja-and-spiritual': '/visuals/pooja-and-spiritual.jpg',
  'handicrafts-and-decor': '/visuals/handicrafts-and-decor.jpg',
  'thaali-and-serveware': '/visuals/Thaali-and-serveware.jpg',
  // Clothing (D-190); Shirts and Tops share a category, so their keys name who they are for
  'shirts-and-tops:men': '/visuals/shirts.jpg',
  'shirts-and-tops:women': '/visuals/tops.jpg',
  'jeans-and-trousers': '/visuals/pants.jpg',
  'co-ords-and-dresses': '/visuals/dresses.jpg',
  'kurtas:women': '/visuals/kurtis.jpg',
  sarees: '/visuals/sarees.jpg',
};
