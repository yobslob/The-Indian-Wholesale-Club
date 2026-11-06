import { unwrap, type IwcClient } from '../client';

/** The store pages of an order's pieces (D-189), for refreshing only them when the pieces go back to stock. */
export async function listOrderPages(
  client: IwcClient,
  orderId: string,
): Promise<{ regionSlug: string | null; productSlug: string }[]> {
  const rows = unwrap(
    await client.from('order_items').select('product:products(slug, region:regions(slug))').eq('order_id', orderId),
  );
  return rows.flatMap((r) =>
    r.product ? [{ regionSlug: r.product.region?.slug ?? null, productSlug: r.product.slug }] : [],
  );
}
