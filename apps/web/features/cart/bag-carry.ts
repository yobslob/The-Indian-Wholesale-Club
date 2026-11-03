'use client';

import { z } from 'zod';

import { decodeBagFragment, mergedQuantity } from './bag-fragment';
import { useCart, type CartLine } from './store';

const variantRow = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  label: z.string(),
  price_cents: z.number().int().nullable(),
});
const productRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  region_slug: z.string().nullable(),
  region_name: z.string().nullable(),
  primary_image_path: z.string().nullable(),
  product_type: z.string(),
});

/**
 * E-1: a bag carried from the old vercel.app address (`#bag=`, bag-fragment.ts), read once on the domain. The fragment
 * is cleared first, so a reload or a shared link never adds it again; then the pieces' names, photos and prices come
 * from the store's own views (D-017; checkout re-prices anyway) and each line is merged at the larger quantity.
 * Pieces no longer in the store are left out. Loaded only when the address has the fragment (store.ts), so the
 * Supabase client stays out of every page's first load.
 */
export async function carryBagFromFragment(): Promise<void> {
  const { hash, pathname, search } = window.location;
  const carried = decodeBagFragment(hash);
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  if (carried.length === 0) return;

  const { browserClient } = await import('@/lib/supabase/browser');
  const client = browserClient();
  const variants = await client
    .from('store_variants')
    .select('id, product_id, label, price_cents')
    .in('id', carried.map((c) => c.variantId));
  const vRows = z.array(variantRow).safeParse(variants.data ?? []);
  if (!vRows.success || vRows.data.length === 0) return;
  const products = await client
    .from('store_products')
    .select('id, name, slug, region_slug, region_name, primary_image_path, product_type')
    .in('id', [...new Set(vRows.data.map((v) => v.product_id))]);
  const pRows = z.array(productRow).safeParse(products.data ?? []);
  if (!pRows.success) return;
  const byProduct = new Map(pRows.data.map((p) => [p.id, p]));

  const { lines, add, setQuantity } = useCart.getState();
  for (const c of carried) {
    const v = vRows.data.find((row) => row.id === c.variantId);
    const p = v ? byProduct.get(v.product_id) : undefined;
    if (!v || !p || v.price_cents === null) continue;
    const inBag = lines.find((l) => l.variantId === v.id)?.quantity ?? 0;
    if (inBag > 0) {
      setQuantity(v.id, mergedQuantity(inBag, c.quantity));
      continue;
    }
    const line: Omit<CartLine, 'quantity'> = {
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      regionSlug: p.region_slug,
      regionName: p.region_name,
      variantLabel: v.label,
      unitPriceCents: v.price_cents,
      imagePath: p.primary_image_path,
      productType: p.product_type,
    };
    add(line, mergedQuantity(0, c.quantity));
  }
}
