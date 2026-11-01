import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

/**
 * Settings for the description redo (D-178): tools/description-redo/.env (not in git), else the sourcing runner's
 * .env, which has the same keys (the worker account). The environment wins over both. Ollama on this laptop does
 * the writing (README: why this model).
 */
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const file of [join(ROOT, '.env'), join(ROOT, '..', 'sourcing-runner', '.env')])
  if (existsSync(file)) config({ path: file, override: false });

const dbSchema = z.object({
  IWC_SUPABASE_URL: z.string().url(),
  IWC_SUPABASE_ANON_KEY: z.string().min(20),
  IWC_WORKER_EMAIL: z.string().email(),
  IWC_WORKER_PASSWORD: z.string().min(6),
});
export type DbEnv = z.infer<typeof dbSchema>;

const modelSchema = z.object({
  OLLAMA_HOST: z
    .string()
    .default('http://127.0.0.1:11434')
    .transform((h) => (/^https?:\/\//.test(h) ? h : `http://${h}`).replace(/\/$/, '')),
  IWC_DESC_MODEL: z.string().default('qwen2.5:7b'),
  /** Listings written at once: Ollama answers them together when its OLLAMA_NUM_PARALLEL allows (README). */
  IWC_DESC_PARALLEL: z.coerce.number().int().min(1).max(16).default(8),
});
export type ModelEnv = z.infer<typeof modelSchema>;

export function dbEnv(): DbEnv {
  const parsed = dbSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  throw new Error(
    `tools/description-redo/.env (or the sourcing runner's) lacks or misspells: ${missing}`,
  );
}

export const modelEnv = (): ModelEnv => modelSchema.parse(process.env);

/** Where the listings wait between the steps: `--out <dir>`, else IWC_DESC_OUT, else tools/description-redo/out. */
export const outDir = (flag: string | null): string =>
  flag ?? process.env.IWC_DESC_OUT ?? join(ROOT, 'out');
