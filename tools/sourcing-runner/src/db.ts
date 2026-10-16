import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { PRODUCT_TYPES } from '@repo/shared/domain';

import {
  clothingPlanSchema,
  foodPlanSchema,
  referencesSchema,
  type ClassWrite,
  type ClothingListing,
  type FoodListing,
  type FoodPassDb,
  type FoodWrite,
  type WeightReferenceRow,
} from '@repo/shared/sourcing/estimate';
import {
  planSchema,
  weightPlanSchema,
  type SourcingPlan,
  type WeightPlan,
  type WeightWrite,
} from '@repo/shared/sourcing/auto';

import { describeNetError, supabaseFetch } from './net';

import type { ProductType } from '@repo/shared/domain';

import type { Env } from './env';

/** D-135: a listing for the liquid check. */
const liquidPlanSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    product_type: z.enum(PRODUCT_TYPES),
    status: z.string(),
    labels: z.array(z.string()),
  }),
);
type LiquidListing = z.infer<typeof liquidPlanSchema>[number];

/** D-134: one home option's weight read from its page (or another option's: similar). */
export interface HomeWrite {
  variant_id: string;
  weight_g: number;
  source: 'shop' | 'packed' | 'similar';
  note: string;
}

/**
 * The runner's door to IWC: the worker account (role `worker`, never a service key) and the worker_sourcing_*
 * functions (D-118). Photos go to product-media under the new listing's folder, which the storage policy allows
 * only for a listing the runner made that has no photos yet.
 */
export class Db implements FoodPassDb {
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

  /** The work: all of it, or one product type's (and one shop's) when two runners share it. */
  async plan(
    checks: number,
    only: { type: ProductType | null; site: string | null },
  ): Promise<SourcingPlan> {
    const args: Record<string, unknown> = { p_checks: checks };
    if (only.type) args.p_type = only.type;
    if (only.site) args.p_site = only.site;
    try {
      return planSchema.parse(await this.rpc('worker_sourcing_plan', args));
    } catch (error) {
      if (only.type && /function|p_type|schema cache/i.test(String(error)))
        throw new Error(
          `the database does not take --type yet: run the Deploy workflow (migration 20261016120000) (${String(error).slice(0, 120)})`,
        );
      throw error;
    }
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

  /** Back to the queue: no shop answered, so nothing is known yet. Before the deploy (no such function) it stays
   * claimed and the database queues it again after 6 hours. */
  async releaseTarget(target: string, note: string): Promise<void> {
    await this.rpc('worker_sourcing_target_release', { p_target: target, p_note: note }).catch(
      () => undefined,
    );
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

  /** D-133: up to 200 food listings to work out, in id order after `after` (`all`: every food listing). */
  async foodPlan(after: string | null, all: boolean): Promise<FoodListing[]> {
    return foodPlanSchema.parse(
      await this.rpc('worker_food_plan', { p_after: after, p_limit: 200, p_all: all }),
    );
  }

  setFoodWeights(weights: FoodWrite[]): Promise<number> {
    return this.rpc('worker_set_food_weights', { p_weights: weights });
  }

  /** D-134: up to `limit` home listings whose weights to read from their pages (`all`: also read ones). */
  async homePlan(limit: number, all: boolean): Promise<WeightPlan> {
    const { data, error } = await this.client.rpc('worker_home_plan', {
      p_limit: limit,
      p_all: all,
    });
    if (!error) return weightPlanSchema.parse(data);
    // before the deploy that adds it, a dry run reads the listings missing a weight (D-129's plan)
    if (!/worker_home_plan/.test(error.message))
      throw new Error(`worker_home_plan: ${error.message}`);
    return (await this.weightPlan(200)).filter((l) => l.product_type === 'home').slice(0, limit);
  }

  setHomeWeights(weights: HomeWrite[]): Promise<number> {
    return this.rpc('worker_set_home_weights', { p_weights: weights });
  }

  /** D-135: up to 200 food and home listings for the liquid check, in id order after `after`. */
  async liquidPlan(after: string | null, all: boolean): Promise<LiquidListing[]> {
    return liquidPlanSchema.parse(
      await this.rpc('worker_liquid_plan', { p_after: after, p_limit: 200, p_all: all }),
    );
  }

  setLiquids(
    items: { product_id: string; liquid: boolean; note: string | null }[],
  ): Promise<number> {
    return this.rpc('worker_set_liquids', { p_items: items });
  }

  /** Every weight IWC knows (weighed, typed, a shop's page): the hub's food weighings tune the pack weights. */
  async references(): Promise<WeightReferenceRow[]> {
    const all: WeightReferenceRow[] = [];
    let after: string | null = null;
    for (;;) {
      const page = referencesSchema.parse(
        await this.rpc('worker_weight_references', { p_after: after, p_limit: 1000 }),
      );
      all.push(...page);
      if (page.length < 1000) return all;
      after = page[page.length - 1]!.variant_id;
    }
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
