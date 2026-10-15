import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  estimatePlanSchema,
  referencesSchema,
  type EstimateListing,
  type EstimateMode,
  type EstimateWrite,
  type WeightReferenceRow,
} from '@repo/shared/sourcing/estimate';

import type { Env } from './env';

/** The estimator's door to IWC: the worker account (never a service key) and the worker_* weight functions (D-131). */
export class Db {
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

  setEstimates(estimates: EstimateWrite[]): Promise<{ estimates: number; weights: number }> {
    return this.rpc('worker_set_estimates', { p_estimates: estimates });
  }
}
