import { assertSafeEnvironment, E2E_SLUG_PREFIX, serviceClient } from './env';

/**
 * After the run: products the admin test created are archived, so the local store
 * doesn't fill up with test listings. Orders stay (they are ordinary local test data);
 * `node scripts/check.mjs db` resets the local database anyway.
 */
export default async function globalTeardown(): Promise<void> {
  assertSafeEnvironment();
  const { error } = await serviceClient()
    .from('products')
    .update({ status: 'archived' })
    .like('slug', `${E2E_SLUG_PREFIX}%`);
  if (error) throw error;
}
