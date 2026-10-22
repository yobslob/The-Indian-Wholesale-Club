import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

/**
 * Settings for the sourcing runner (D-118), from tools/sourcing-runner/.env (not in git; the founder writes it) or
 * the environment, which wins. The same worker account as the photo worker can be used.
 */
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const file = join(ROOT, '.env');
if (existsSync(file)) config({ path: file, override: false });

const schema = z.object({
  IWC_SUPABASE_URL: z.string().url(),
  IWC_SUPABASE_ANON_KEY: z.string().min(20),
  IWC_WORKER_EMAIL: z.string().email(),
  IWC_WORKER_PASSWORD: z.string().min(6),
  /** The browser profile that keeps the hub's address on every shop (setup writes it). */
  IWC_SOURCING_PROFILE: z.string().default(join(homedir(), 'iwc-sourcing-profile')),
  /** "chrome" (installed Google Chrome, shops trust it most), "msedge", or "chromium" (Playwright's own). */
  IWC_SOURCING_CHANNEL: z.enum(['chrome', 'msedge', 'chromium']).default('chrome'),
  /** Ignored (D-151): shops block headless Chrome, so the runner always opens a window off-screen. */
  IWC_SOURCING_HEADLESS: z.enum(['0', '1']).default('0'),
  /** The photo store (D-140, src/photo-store.ts): the bucket's S3 address and an API token for it. Optional. */
  IWC_PHOTO_STORE_S3_URL: z.string().url().optional(),
  IWC_PHOTO_STORE_KEY_ID: z.string().min(1).optional(),
  IWC_PHOTO_STORE_SECRET: z.string().min(1).optional(),
  IWC_PHOTO_STORE_REGION: z.string().default('auto'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(needDatabase: boolean): Env {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return parsed.data;
  if (!needDatabase) {
    return schema.parse({
      IWC_SUPABASE_URL: 'https://unused.example.com',
      IWC_SUPABASE_ANON_KEY: 'unused-unused-unused-unused',
      IWC_WORKER_EMAIL: 'unused@example.com',
      IWC_WORKER_PASSWORD: 'unused',
      ...process.env,
    });
  }
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  throw new Error(`Set ${missing} in tools/sourcing-runner/.env (see README.md).`);
}
