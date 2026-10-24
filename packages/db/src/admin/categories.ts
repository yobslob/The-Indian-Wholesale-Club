import { unwrap, type IwcClient } from '../client';

/**
 * Categories to check (founder, 2026-10-24): every food and home listing that customers see or will see (not archived)
 * with its category, read 1,000 at a time (the API's page). The rules that judge them are in
 * @repo/shared/sourcing (category-check.ts); clothing is not checked.
 */
export async function listCategoriesToCheck(client: IwcClient) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = unwrap(
      await client
        .from('products')
        .select('id, name, product_type, status, category:categories(id, slug, name)')
        .in('product_type', ['food', 'home'])
        .neq('status', 'archived')
        .order('id')
        .range(from, from + 999),
    );
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
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
