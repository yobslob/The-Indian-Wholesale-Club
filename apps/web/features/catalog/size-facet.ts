/** A size (or food pack) list longer than this is trimmed; Clothing's standard sizes (about 100) stay whole. */
export const SIZE_LIST_MAX = 100;
/** How many sizes a trimmed list keeps: those with the most pieces. */
export const SIZE_LIST_KEEP = 60;

interface Size {
  value: string;
  count: number;
}

/**
 * See all's Size / Pack filter (D-136) keeps the sizes most pieces share. Food and Home & gifts read their packs as the
 * shops write them ("200 g", "200g", "200 g (Pack of 1)", "400.0 Grams"…): on the production copy of 2026-10-24 that
 * was 1,687 food packs and 1,121 home sizes, most with one piece, drawn twice (the panel and the phone's sheet) and sent
 * again in the page's data: about 540 KB of /food's 685 KB of HTML and 60 KB of each 75 KB /api/browse answer. A long
 * list keeps its SIZE_LIST_KEEP biggest sizes and every size the address has chosen, in their own order.
 */
export function usefulSizes<T extends { sizes: Size[] }>(page: T, chosen: readonly string[] = []): T {
  if (page.sizes.length <= SIZE_LIST_MAX) return page;
  const keep = new Set(chosen);
  for (const s of [...page.sizes].sort((a, b) => b.count - a.count).slice(0, SIZE_LIST_KEEP)) keep.add(s.value);
  return { ...page, sizes: page.sizes.filter((s) => keep.has(s.value)) };
}
