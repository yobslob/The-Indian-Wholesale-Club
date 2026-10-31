import { unwrap, unwrapPage, type IwcClient } from '../client';

/**
 * Categories to check (founder, 2026-10-24): every food and home listing that customers see or will see (not archived)
 * with its category, read 1,000 at a time (the API's page), the pages side by side. The rules that judge them are in
 * @repo/shared/sourcing (category-check.ts); clothing is not checked.
 */
export async function listCategoriesToCheck(client: IwcClient) {
  const page = (from: number, count: boolean) =>
    client
      .from('products')
      .select('id, name, product_type, status, category:categories(id, slug, name)', count ? { count: 'exact' } : undefined)
      .in('product_type', ['food', 'home'])
      .neq('status', 'archived')
      .order('id')
      .range(from, from + 999);
  // the first 1,000 with the total, then the rest side by side (one short read each, D-146)
  const first = unwrapPage(await page(0, true));
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(Math.max(first.total - 1000, 0) / 1000) }, (_, i) => page((i + 1) * 1000, false)),
  );
  return [...first.rows, ...rest.flatMap((r) => unwrap(r))];
}

/**
 * Listings moved to another category of their own type, one statement per category (D-146: well inside the statement
 * limit). The database reprices a moved listing (products_auto_price), which only changes a price where an option has
 * no weight yet (the category's default weight stands in). Returns how many moved.
 */
export async function moveListings(client: IwcClient, moves: { id: string; categoryId: string }[]): Promise<number> {
  const byCategory = new Map<string, string[]>();
  for (const m of moves) byCategory.set(m.categoryId, [...(byCategory.get(m.categoryId) ?? []), m.id]);
  let moved = 0;
  for (const [categoryId, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += 100) {
      const rows = unwrap(
        await client
          .from('products')
          .update({ category_id: categoryId })
          .in('id', ids.slice(i, i + 100))
          .neq('category_id', categoryId)
          .select('id'),
      );
      moved += rows.length;
    }
  }
  return moved;
}

/** Listings archived (not deleted): customers no longer see them; an admin can bring one back from Products. */
export async function archiveListings(client: IwcClient, ids: string[]): Promise<number> {
  let archived = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const rows = unwrap(
      await client
        .from('products')
        .update({ status: 'archived' })
        .in('id', ids.slice(i, i + 100))
        .neq('status', 'archived')
        .select('id'),
    );
    archived += rows.length;
  }
  return archived;
}
