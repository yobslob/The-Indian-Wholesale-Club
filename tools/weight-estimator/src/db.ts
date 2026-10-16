import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  clothingPlanSchema,
  foodPlanSchema,
  estimatePlanSchema,
  referencesSchema,
  type ClassWrite,
  type ClothingListing,
  type FoodListing,
  type FoodPassDb,
  type FoodWrite,
  type EstimateListing,
  type EstimateMode,
  type EstimateWrite,
  type WeightReferenceRow,
} from '@repo/shared/sourcing/estimate';

import type { Env } from './env';

/** The estimator's door to IWC: the worker account (never a service key) and the worker_* weight functions (D-131). */
export class Db implements FoodPassDb {
  private constructor(private readonly client: SupabaseClient) {}

  static async signIn(env: Env): Promise<Db> {
    const client = createClient(env.IWC_SUPABASE_URL, env.IWC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    const { error } = await client.auth.signInWithPassword({
      email: env.IWC_WORKER_EMAIL,
      password: env.IWC_WORKER_PASSWORD,
    });
    if (error) throw new Error(`Worker sign-in failed: ${error.message}`);
    return new Db(client);
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }

  /** Up to 200 listings to estimate, in id order after `after`. */
  async plan(after: string | null, limit: number, mode: EstimateMode): Promise<EstimateListing[]> {
    return estimatePlanSchema.parse(
      await this.rpc('worker_estimate_plan', { p_after: after, p_limit: limit, p_mode: mode }),
    );
  }

  /** Every weight IWC knows (weighed, typed, a shop's page). */
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

  /** D-132: up to 200 clothing listings to sort by class, in id order after `after` (`all`: also sorted ones). */
  async clothingPlan(after: string | null, all: boolean): Promise<ClothingListing[]> {
    return clothingPlanSchema.parse(
      await this.rpc('worker_clothing_plan', { p_after: after, p_limit: 200, p_all: all }),
    );
  }

  setClassWeights(weights: ClassWrite[]): Promise<number> {
    return this.rpc('worker_set_class_weights', { p_weights: weights });
  }

  /**
   * D-133: up to 200 food listings to work out, in id order after `after` (`all`: every food listing). Before the
   * deploy that adds worker_food_plan(), a dry run reads them through the estimator's plan instead.
   */
  async foodPlan(after: string | null, all: boolean): Promise<FoodListing[]> {
    const { data, error } = await this.client.rpc('worker_food_plan', {
      p_after: after,
      p_limit: 200,
      p_all: all,
    });
    if (!error) return foodPlanSchema.parse(data);
    if (
      !/worker_food_plan/.test(error.message) ||
      !/could not find|does not exist/i.test(error.message)
    )
      throw new Error(`worker_food_plan: ${error.message}`);
    // the estimator's plan holds food and home: skip pages without food
    for (let cursor = after; ;) {
      const page = await this.plan(cursor, 200, 'audit');
      if (!page.length) return [];
      const food = page.filter((l) => l.product_type === 'food');
      if (food.length)
        return food.map((l) => ({
          product_id: l.product_id,
          name: l.name,
          category: l.category,
          description: [l.summary, l.description].filter(Boolean).join('\n'),
          variants: l.variants.map((v) => ({ ...v, net_qty: null })),
        }));
      cursor = page[page.length - 1]!.product_id;
    }
  }

  setFoodWeights(weights: FoodWrite[]): Promise<number> {
    return this.rpc('worker_set_food_weights', { p_weights: weights });
  }

  setEstimates(estimates: EstimateWrite[]): Promise<{ estimates: number; weights: number }> {
    return this.rpc('worker_set_estimates', { p_estimates: estimates });
  }
}
