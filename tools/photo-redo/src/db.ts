import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import type { Env } from './env';

/** The redo's door to IWC: the worker account (never a service key) and the worker_photo_* functions (D-163). */

const planSchema = z.object({
  house_models: z.array(z.object({ slug: z.string(), wears: z.enum(['women', 'men']) })),
  listings: z.array(
    z.object({
      product_id: z.string().uuid(),
      name: z.string(),
      category: z.string(),
      wears: z.string().nullable(),
      photos: z.array(z.object({ id: z.string().uuid(), path: z.string(), alt: z.string(), main: z.boolean() })),
    }),
  ),
});
export type RedoPlan = z.infer<typeof planSchema>;
export type RedoListing = RedoPlan['listings'][number];

export const typeArg = (value: string | null): ProductType => {
  const type = PRODUCT_TYPES.find((t) => t === value);
  if (!type) throw new Error(`--type is one of ${PRODUCT_TYPES.join(', ')}`);
  return type;
};

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
    if (error) throw new Error(`worker sign-in: ${error.message}`);
    return new Db(client);
  }

  /** Stops the session's token refresh, so the process can end cleanly. */
  close(): void {
    void this.client.auth.stopAutoRefresh();
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) {
      if (/schema cache|does not exist/i.test(error.message))
        throw new Error(`${fn} is missing: run the Deploy workflow (migration 20261102090000)`);
      throw new Error(`${fn}: ${error.message}`);
    }
    return data as T;
  }

  async plan(type: ProductType, after: string | null, limit: number): Promise<RedoPlan> {
    return planSchema.parse(
      await this.rpc('worker_photo_redo_plan', { p_type: type, p_after: after, p_limit: limit }),
    );
  }

  /** A photo's new path (`face`, `food`) or `kept` (no new path); false when the row changed since it was read. */
  set(media: string, oldPath: string, newPath: string | null, redo: 'face' | 'food' | 'kept'): Promise<boolean> {
    return this.rpc('worker_photo_redo_set', {
      p_media: media,
      p_old_path: oldPath,
      p_new_path: newPath,
      p_redo: redo,
    });
  }

  /** Home: the scene becomes the main photo; null when the main photo changed since it was read. */
  scene(media: string, oldPath: string, newPath: string, alt: string): Promise<string | null> {
    return this.rpc('worker_photo_redo_scene', {
      p_media: media,
      p_old_path: oldPath,
      p_new_path: newPath,
      p_alt: alt,
    });
  }

  /** Of these stored photos (paths without the extension), the ones a listing still shows. */
  async inUse(stems: string[]): Promise<Set<string>> {
    const shown = new Set<string>();
    for (let i = 0; i < stems.length; i += 1000)
      for (const s of await this.rpc<string[]>('worker_photo_stems_in_use', { p_stems: stems.slice(i, i + 1000) }))
        shown.add(s);
    return shown;
  }
}
