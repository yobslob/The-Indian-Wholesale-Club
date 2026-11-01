import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { z } from 'zod';

import { client, type Db, type Listing } from './db';
import { cursorFile, itemDir, readItem, writeItem } from './items';
import { log } from './log';

import type { DbEnv } from './env';
import type { ProductType } from '@repo/shared/domain';

/** Listings read per call: a small page, so each call stays well inside the free plan's limits. */
const PAGE = 25;

/** A listing saved for the next steps; false when it is here already (as read, or done). */
function save(out: string, listing: Listing, trial = false): boolean {
  const dir = itemDir(out, listing.type, listing.product_id);
  const had = readItem(dir);
  // words changed while they waited (left alone by publish) come back as the words they are now
  if (had && !(had.stale && had.hash !== listing.hash) && !(had.trial && !trial)) return false;
  rmSync(dir, { recursive: true, force: true });
  writeItem(dir, { ...listing, fetched_at: new Date().toISOString(), ...(trial ? { trial } : {}) });
  return true;
}

/**
 * `fetch`: the next listings with words to do into the work folder. Pages on from where the last fetch stopped
 * (`--again` starts over: listings already here are skipped, so only new ones and changed ones come back).
 */
export async function fetchListings(
  out: string,
  db: Db,
  type: ProductType | null,
  opts: { limit: number; again: boolean },
): Promise<string[]> {
  mkdirSync(out, { recursive: true });
  const cursor = cursorFile(out, type);
  let after =
    !opts.again && existsSync(cursor) ? readFileSync(cursor, 'utf8').trim() || null : null;
  const got: string[] = [];
  while (got.length < opts.limit) {
    const page = await db.plan(type, after, Math.min(PAGE, opts.limit - got.length));
    if (!page.length) {
      log(`${type ?? 'all types'}: no more listings with words to do`);
      break;
    }
    for (const listing of page) if (save(out, listing)) got.push(listing.product_id);
    after = page.at(-1)!.product_id;
    writeFileSync(cursor, after);
  }
  log(`${type ?? 'all types'}: ${got.length} listings fetched into ${out}`);
  return got;
}

const storeRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  product_type: z.enum(['clothing', 'food', 'home']),
  category_name: z.string(),
  attributes: z.record(z.string(), z.unknown()).catch({}),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  made_in_india: z.boolean().nullable(),
});

/**
 * `try`: a look before the deploy. Live listings from the store's public view (what any visitor reads; no sign-in,
 * no worker function) into a scratch work folder, marked `trial` so `publish` never sends them.
 */
export async function tryListings(
  out: string,
  env: Pick<DbEnv, 'IWC_SUPABASE_URL' | 'IWC_SUPABASE_ANON_KEY'>,
  type: ProductType | null,
  opts: { limit: number; skip: number },
): Promise<number> {
  const c = client(env);
  const types: ProductType[] = type ? [type] : ['clothing', 'food', 'home'];
  let got = 0;
  for (const [i, t] of types.entries()) {
    const n = Math.ceil((opts.limit - got) / (types.length - i));
    const { data, error } = await c
      .from('store_products')
      .select(
        'id, name, product_type, category_name, attributes, summary, description, made_in_india',
      )
      .eq('product_type', t)
      .not('description', 'is', null)
      .order('id')
      .range(opts.skip, opts.skip + n - 1);
    if (error) throw new Error(`store_products: ${error.message}`);
    for (const r of z.array(storeRow).parse(data)) {
      const listing: Listing = {
        product_id: r.id,
        type: r.product_type,
        name: r.name,
        category: r.category_name,
        wears: null,
        attributes: r.attributes,
        summary: r.summary,
        description: r.description,
        shop_title: null,
        shop: null,
        made_in: r.made_in_india === false ? null : 'India',
        hash: '',
      };
      if (save(out, listing, true)) got += 1;
    }
  }
  log(`try: ${got} live listings read into ${out} (a trial: never published)`);
  return got;
}
