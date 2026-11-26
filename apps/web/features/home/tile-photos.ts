/**
 * The founder's own photos for Home's category tiles (founder 2026-11-03: "I want to update the categories photos"). To
 * set one: put the file in apps/web/public/visuals/ (WebP, JPEG or AVIF, at most 800 px a side) and write its path beside
 * the category, e.g. 'sweets': '/visuals/sweets.webp'. Since 2026-11-26 (the founder's new set, made from the Photoroom
 * PNGs as WebP) a tile shows its photo whole, not zoomed or cropped, on the photos' own grey (category-tiles.tsx).
 * Left null, a tile shows its category's newest piece (D-187).
 */
export const TILE_PHOTOS: Record<string, string | null> = {
  // Food
  'snacks-and-namkeen': '/visuals/snacks-and-namkeen.webp',
  'bakery-and-biscuits': null,
  sweets: '/visuals/sweets.webp',
  'rice-flours-and-staples': '/visuals/rice-flours-and-staples.webp',
  'masala-blends': '/visuals/masala-blends.webp',
  'pickles-and-chutneys': '/visuals/pickles-and-chutneys.webp',
  'whole-spices': '/visuals/whole-spices.webp',
  'tea-and-drinks': '/visuals/tea-and-drinks.webp',
  'papad-and-wadi': '/visuals/papad-and-wadi.webp',
  // Home & gifts
  'pooja-and-spiritual': '/visuals/pooja-and-spiritual.webp',
  'handicrafts-and-decor': '/visuals/handicrafts-and-decor.webp',
  'thaali-and-serveware': '/visuals/thaali-and-serveware.webp',
  // D-195: Traditional wear opens Clothing from every state
  'traditional-wear': '/visuals/diwali-clothing.jpg',
  // Clothing (D-190); Shirts and Tops share a category, so their keys name who they are for
  'shirts-and-tops:men': '/visuals/shirts.webp',
  'shirts-and-tops:women': '/visuals/tops.webp',
  'jeans-and-trousers': '/visuals/pants.webp',
  'co-ords-and-dresses': '/visuals/dresses.webp',
  'kurtas:women': '/visuals/kurtis.webp',
  sarees: '/visuals/sarees.webp',
};
