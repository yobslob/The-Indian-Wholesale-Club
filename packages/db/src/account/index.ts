/**
 * The signed-in customer's OWN rows (data-model.md "owner" level): profile,
 * addresses, saved products. RLS limits every query to auth.uid(); these
 * tables hold no operations data, so they are safe for customer code.
 * Catalog data for saved products still comes from store_* (D-017).
 */
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';
import { productCardSchema, type ProductCard } from '../store/schemas';

export async function getMyProfile(client: IwcClient, userId: string) {
  return unwrap(
    await client
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('id', userId)
      .maybeSingle(),
  );
}

/** Only full_name and phone are writable by a customer (column grant in the baseline migration). */
export async function updateMyProfile(
  client: IwcClient,
  userId: string,
  patch: { full_name?: string | null; phone?: string | null },
) {
  unwrap(await client.from('profiles').update(patch).eq('id', userId));
}

// ---------------------------------------------------------------- addresses

const ADDRESS_COLUMNS =
  'id, label, full_name, line1, line2, city, state, zip_code, phone, is_default';

export interface AddressInput {
  label: string | null;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
}

function toRow(input: AddressInput) {
  return {
    label: input.label,
    full_name: input.fullName,
    line1: input.line1,
    line2: input.line2,
    city: input.city,
    state: input.state,
    zip_code: input.zipCode,
    phone: input.phone,
  };
}

export async function listMyAddresses(client: IwcClient) {
  return unwrap(
    await client
      .from('addresses')
      .select(ADDRESS_COLUMNS)
      .order('is_default', { ascending: false })
      .order('created_at'),
  );
}

export async function addMyAddress(client: IwcClient, userId: string, input: AddressInput) {
  unwrap(await client.from('addresses').insert({ ...toRow(input), user_id: userId }));
}

export async function deleteMyAddress(client: IwcClient, id: string) {
  unwrap(await client.from('addresses').delete().eq('id', id));
}

/** One default per user (unique partial index): clear the old one first. */
export async function setDefaultAddress(client: IwcClient, userId: string, id: string) {
  unwrap(
    await client
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true),
  );
  unwrap(await client.from('addresses').update({ is_default: true }).eq('id', id));
}

// ---------------------------------------------------------------- saved products (wishlists)

export async function listSavedProductIds(client: IwcClient): Promise<string[]> {
  const rows = unwrap(
    await client.from('wishlists').select('product_id').order('created_at', { ascending: false }),
  );
  return rows.map((row) => row.product_id);
}

export async function saveProduct(client: IwcClient, userId: string, productId: string) {
  unwrap(
    await client
      .from('wishlists')
      .upsert(
        { user_id: userId, product_id: productId },
        { onConflict: 'user_id,product_id', ignoreDuplicates: true },
      ),
  );
}

export async function unsaveProduct(client: IwcClient, productId: string) {
  unwrap(await client.from('wishlists').delete().eq('product_id', productId));
}

const SAVED_CARD_COLUMNS =
  'id, slug, name, product_type, region_slug, region_name, category_slug, category_name, summary, price_cents, primary_image_path';

/** Saved products that are still visible in the store (2 round trips; account pages are dynamic). */
export async function listSavedProducts(client: IwcClient): Promise<ProductCard[]> {
  const ids = await listSavedProductIds(client);
  if (ids.length === 0) return [];
  const data = unwrap(await client.from('store_products').select(SAVED_CARD_COLUMNS).in('id', ids));
  return z.array(productCardSchema).parse(data);
}

export * from './reviews';
