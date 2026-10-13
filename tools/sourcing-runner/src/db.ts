import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { planSchema, type SourcingPlan } from '@repo/shared/sourcing/auto';

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
