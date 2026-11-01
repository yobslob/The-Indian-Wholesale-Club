import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import type { DbEnv } from './env';

/** The redo's door to IWC: the worker account (never a service key) and the worker_description_* functions (D-178). */

export const listingSchema = z.object({
  product_id: z.string().uuid(),
  type: z.enum(PRODUCT_TYPES),
  name: z.string(),
  category: z.string(),
  wears: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()).catch({}),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  shop_title: z.string().nullable().default(null),
  shop: z.string().nullable().default(null),
  made_in: z.string().nullable().default(null),
  hash: z.string(),
});
export type Listing = z.infer<typeof listingSchema>;

export const typeArg = (value: string | null): ProductType | null => {
  if (value === null) return null;
  const type = PRODUCT_TYPES.find((t) => t === value);
  if (!type) throw new Error(`--type is one of ${PRODUCT_TYPES.join(', ')}`);
  return type;
};

export const client = (
  env: Pick<DbEnv, 'IWC_SUPABASE_URL' | 'IWC_SUPABASE_ANON_KEY'>,
): SupabaseClient =>
  createClient(env.IWC_SUPABASE_URL, env.IWC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

export class Db {
  private constructor(private readonly client: SupabaseClient) {}

  static async signIn(env: DbEnv): Promise<Db> {
    const c = client(env);
    const { error } = await c.auth.signInWithPassword({
      email: env.IWC_WORKER_EMAIL,
      password: env.IWC_WORKER_PASSWORD,
    });
    if (error) throw new Error(`worker sign-in: ${error.message}`);
    return new Db(c);
  }

  /** Stops the session's token refresh, so the process can end cleanly. */
  close(): void {
    void this.client.auth.stopAutoRefresh();
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) {
      if (/schema cache|does not exist/i.test(error.message))
        throw new Error(`${fn} is missing: run the Deploy workflow (migration 20261107090000)`);
      throw new Error(`${fn}: ${error.message}`);
    }
    return data as T;
  }

  /** The next listings with words still to do, by id after `after` (at most 50 a page). */
  async plan(type: ProductType | null, after: string | null, limit: number): Promise<Listing[]> {
    return z
      .array(listingSchema)
      .parse(
        await this.rpc('worker_description_plan', { p_type: type, p_after: after, p_limit: limit }),
      );
  }

  /** The new words; false when the listing's words changed since they were read (or it is done already). */
  set(
    product: string,
    hash: string,
    words: { summary: string; description: string },
    redo: 'rewritten' | 'edited',
  ) {
    return this.rpc<boolean>('worker_description_set', {
      p_product: product,
      p_hash: hash,
      p_summary: words.summary,
      p_description: words.description,
      p_redo: redo,
    });
  }
}
