import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

/**
 * Settings for the photo redo (D-163): tools/photo-redo/.env (not in git; the founder writes it), else the sourcing
 * runner's .env, which has the same keys (the worker account and the photo store). The environment wins over both.
 */
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const file of [join(ROOT, '.env'), join(ROOT, '..', 'sourcing-runner', '.env')])
  if (existsSync(file)) config({ path: file, override: false });

const schema = z.object({
  IWC_SUPABASE_URL: z.string().url(),
  IWC_SUPABASE_ANON_KEY: z.string().min(20),
  IWC_WORKER_EMAIL: z.string().email(),
  IWC_WORKER_PASSWORD: z.string().min(6),
  /** The photo store (D-140): the bucket's S3 address and an API token that can read, write, list and delete. */
  IWC_PHOTO_STORE_S3_URL: z.string().url(),
  IWC_PHOTO_STORE_KEY_ID: z.string().min(1),
  IWC_PHOTO_STORE_SECRET: z.string().min(1),
  IWC_PHOTO_STORE_REGION: z.string().default('auto'),
  /** Where the photos wait between the steps (default tools/photo-redo/out; not in git). */
  IWC_REDO_OUT: z.string().default(join(ROOT, 'out')),
  /** The photo worker's models, with the house models (as tools/photo-worker reads it). */
  IWC_MODELS: z.string().default('C:\\kod\\iwc-photo-models'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return parsed.data;
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  throw new Error(`tools/photo-redo/.env (or the sourcing runner's) lacks or misspells: ${missing}`);
}

/** Only the folder: `review` and `status` need no account. */
export const outDir = (): string => process.env.IWC_REDO_OUT ?? join(ROOT, 'out');
