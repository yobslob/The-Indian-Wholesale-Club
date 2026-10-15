import { appendFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

/**
 * Settings for the weight estimator (D-131): tools/weight-estimator/.env, else the sourcing runner's
 * (tools/sourcing-runner/.env: the same worker account), else the environment, which wins over both.
 */
export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
for (const file of [join(ROOT, '.env'), join(ROOT, '..', 'sourcing-runner', '.env')])
  if (existsSync(file)) config({ path: file, override: false });

const schema = z.object({
  IWC_SUPABASE_URL: z.string().url(),
  IWC_SUPABASE_ANON_KEY: z.string().min(20),
  IWC_WORKER_EMAIL: z.string().email(),
  IWC_WORKER_PASSWORD: z.string().min(6),
});
export type Env = z.infer<typeof schema>;

const modelSchema = z.object({
  /** Ollama on this laptop (its GPU does the work). */
  OLLAMA_HOST: z
    .string()
    .default('http://127.0.0.1:11434')
    .transform((h) => (/^https?:\/\//.test(h) ? h : `http://${h}`).replace(/\/$/, '')),
  /** The model that weighs (README.md: why this one). */
  IWC_WEIGHT_MODEL: z.string().default('qwen2.5:7b'),
  /** The model that finds similar items. */
  IWC_EMBED_MODEL: z.string().default('nomic-embed-text'),
  /** Listings asked at once: Ollama answers them together on the GPU when its OLLAMA_NUM_PARALLEL allows (README). */
  IWC_WEIGHT_PARALLEL: z.coerce.number().int().min(1).max(16).default(8),
});
export type ModelEnv = z.infer<typeof modelSchema>;

export const modelEnv = (): ModelEnv => modelSchema.parse(process.env);

/** The worker account, or null when it is not set (try works without one). */
export function dbEnv(): Env | null {
  const parsed = schema.safeParse(process.env);
  return parsed.success ? parsed.data : null;
}

export function needDbEnv(): Env {
  const env = dbEnv();
  if (env) return env;
  throw new Error(
    'Set IWC_SUPABASE_URL, IWC_SUPABASE_ANON_KEY, IWC_WORKER_EMAIL and IWC_WORKER_PASSWORD in ' +
      'tools/weight-estimator/.env or tools/sourcing-runner/.env (README.md).',
  );
}

/** One line per event on the console and in estimator.log (next to the tool, not in git). */
export function log(message: string): void {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try {
    appendFileSync(join(ROOT, 'estimator.log'), `${line}\n`);
  } catch {
    // a read-only folder must not stop the run
  }
}

export const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
