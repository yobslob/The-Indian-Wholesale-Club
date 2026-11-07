/**
 * The founder's own photos for the sub-categories' rail (D-191: "take one by default, first product, as I will update
 * later"). To set one: put the file in apps/web/public/visuals/ (JPEG or WebP, square, about 200 × 200: it shows at 52 px)
 * and write its path beside the sub-category's slug, e.g. 'chips-and-wafers': '/visuals/chips-and-wafers.jpg'. The slugs
 * are in supabase/migrations/20261111090100_subcategories_popular_packs.sql. Not listed: the sub-category's first piece.
 */
export const SUB_PHOTOS: Record<string, string> = {};
