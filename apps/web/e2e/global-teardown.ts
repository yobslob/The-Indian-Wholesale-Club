import { assertSafeEnvironment, DEMO_PRODUCT, E2E_SLUG_PREFIX, serviceClient } from './env';

/**
 * After the run: products the admin test created, and the US clearance drafts the
 * returns test made from the demo product, are archived, so the local store doesn't
 * fill up with test listings. Orders stay (they are ordinary local test data);
 * `node scripts/check.mjs db` resets the local database anyway.
 */
export default async function globalTeardown(): Promise<void> {
  assertSafeEnvironment();
  const { error } = await serviceClient()
    .from('products')
    .update({ status: 'archived' })
    .like('slug', `${E2E_SLUG_PREFIX}%`);
  if (error) throw error;
  const { error: clearanceError } = await serviceClient()
    .from('products')
    .update({ status: 'archived' })
    .eq('is_us_stock', true)
    .like('slug', `${DEMO_PRODUCT.slug}-us-%`);
  if (clearanceError) throw clearanceError;
}
