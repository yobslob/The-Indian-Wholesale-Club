import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  clothingPlanSchema,
  type ClassWrite,
  type ClothingListing,
} from '@repo/shared/sourcing/estimate';
import {
  planSchema,
  weightPlanSchema,
  type SourcingPlan,
  type WeightPlan,
  type WeightWrite,
} from '@repo/shared/sourcing/auto';

import { describeNetError, supabaseFetch } from './net';

import type { Env } from './env';

/**
 * The runner's door to IWC: the worker account (role `worker`, never a service key) and the worker_sourcing_*
 * functions (D-118). Photos go to product-media under the new listing's folder, which the storage policy allows
 * only for a listing the runner made that has no photos yet.
 */
export class Db {
  private constructor(private readonly client: SupabaseClient) {}

  static async signIn(env: Env): Promise<Db> {
    const client = createClient(env.IWC_SUPABASE_URL, env.IWC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true },
      global: { fetch: supabaseFetch },
    });
    const { error } = await client.auth.signInWithPassword({
      email: env.IWC_WORKER_EMAIL,
      password: env.IWC_WORKER_PASSWORD,
    });
    if (error) {
      const why = (error as { originalError?: unknown }).originalError;
      throw new Error(
        `Worker sign-in failed: ${why ? describeNetError(why) : error.message}` +
          (error.status
            ? ''
            : ` (check IWC_SUPABASE_URL and this PC's internet; \`pnpm sourcing doctor\` tests the road)`),
      );
    }
    return new Db(client);
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }

  async plan(checks: number): Promise<SourcingPlan> {
    return planSchema.parse(await this.rpc('worker_sourcing_plan', { p_checks: checks }));
  }

  add(target: string, listing: unknown): Promise<{ product_id: string; created: boolean }> {
    return this.rpc('worker_sourcing_add', { p_target: target, p_listing: listing });
  }

  media(
    product: string,
    media: { path: string; alt_text: string; item_key?: string }[],
    publish: boolean,
  ) {
    return this.rpc<{ published: boolean; note: string | null }>('worker_sourcing_media', {
      p_product: product,
      p_media: media,
      p_publish: publish,
    });
  }

  targetDone(target: string, note: string | null): Promise<void> {
    return this.rpc('worker_sourcing_target_done', { p_target: target, p_note: note });
  }

  checked(product: string, results: unknown) {
    return this.rpc<{ price_changes: number; stock_changes: number; held: number; added: number }>(
      'worker_sourcing_checked',
      { p_product: product, p_results: results },
    );
  }

  /** D-129: listings whose options have no weight (or only a matching item's). */
  async weightPlan(limit: number): Promise<WeightPlan> {
    return weightPlanSchema.parse(await this.rpc('worker_weight_plan', { p_limit: limit }));
  }

  setWeights(weights: WeightWrite[]): Promise<number> {
    return this.rpc('worker_set_weights', { p_weights: weights });
  }

  /** D-132: clothing listings to sort by class (200 at most, in id order after `after`). */
  async clothingPlan(after: string | null): Promise<ClothingListing[]> {
    return clothingPlanSchema.parse(
      await this.rpc('worker_clothing_plan', { p_after: after, p_limit: 200, p_all: false }),
    );
  }

  setClassWeights(weights: ClassWrite[]): Promise<number> {
    return this.rpc('worker_set_class_weights', { p_weights: weights });
  }

  logRun(run: Record<string, unknown>): Promise<void> {
    return this.rpc('worker_sourcing_log', { p_run: run });
  }

  /** Uploads one photo under products/<id>/ and returns its path. */
  async upload(product: string, bytes: Buffer, contentType: string): Promise<string> {
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `products/${product}/${randomUUID()}.${ext}`;
    const { error } = await this.client.storage
      .from('product-media')
      .upload(path, bytes, { contentType, upsert: false, cacheControl: '31536000' });
    if (error) throw new Error(`photo upload: ${error.message}`);
    return path;
  }
}
