import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { listingSchema } from './db';

/**
 * The redo's work, one folder per listing under out/<type>/<product id>/, so any step can stop and carry on:
 *   item.json      the listing's words as read (written by `fetch` or `try`; `publish` adds what it did). The shop's
 *                  words stay here once the new ones are live: the only copy, if a listing must be looked at again
 *   result.json    the new words and what the checks found (`make`)
 *   decision.json  the founder's approve, reject or edit (the review page)
 * Each file has one writer. Once a listing is live, `publish` deletes its result and decision (the words are in the
 * database); item.json stays, so `fetch` never takes it again.
 */

export const itemSchema = listingSchema.extend({
  fetched_at: z.string(),
  /** Read by `try` from the store's public view: never published (no hash from the worker functions). */
  trial: z.boolean().optional(),
  published: z.object({ at: z.string(), redo: z.enum(['rewritten', 'edited']) }).optional(),
  /** Set by `publish` when the listing's words changed meanwhile: left alone, and fetched again as they are now. */
  stale: z.boolean().optional(),
});
export type Item = z.infer<typeof itemSchema>;

const wordsSchema = z.object({ summary: z.string(), description: z.string() });

export const resultSchema = z.object({
  /** made: passed every check; flagged: still failing after every try (the founder's call); failed: no answer. */
  status: z.enum(['made', 'flagged', 'failed']),
  words: wordsSchema.nullable(),
  failures: z.array(z.string()),
  overlap: z.number(),
  run: z.number(),
  tries: z.number(),
  /** How many times `make` wrote this listing (each time with new seeds). */
  round: z.number().default(1),
  seconds: z.number(),
  tokens: z.number(),
  model: z.string(),
  at: z.string(),
});
export type Result = z.infer<typeof resultSchema>;

/** The founder's choice; `words` is the founder's own edit, which goes out as `edited`. */
export const decisionSchema = z.object({
  ok: z.boolean(),
  at: z.string(),
  words: wordsSchema.optional(),
});
export type Decision = z.infer<typeof decisionSchema>;

export interface Work {
  dir: string;
  item: Item;
  result: Result | null;
  decision: Decision | null;
}

const read = <S extends z.ZodTypeAny>(file: string, schema: S): z.output<S> | null => {
  if (!existsSync(file)) return null;
  try {
    return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
};

const write = (file: string, data: unknown): void =>
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

export const itemDir = (out: string, type: string, id: string): string => join(out, type, id);
export const readItem = (dir: string): Item | null => read(join(dir, 'item.json'), itemSchema);

export function writeItem(dir: string, item: Item): void {
  mkdirSync(dir, { recursive: true });
  write(join(dir, 'item.json'), item);
}

export const writeResult = (dir: string, result: Result): void =>
  write(join(dir, 'result.json'), result);

export function writeDecision(dir: string, decision: Omit<Decision, 'at'>): void {
  write(join(dir, 'decision.json'), { ...decision, at: new Date().toISOString() });
}

export const clearDecision = (dir: string): void =>
  rmSync(join(dir, 'decision.json'), { force: true });

/** A live listing keeps only its item.json (with the shop's words as read). */
export function tidy(dir: string): void {
  for (const file of ['result.json', 'decision.json']) rmSync(join(dir, file), { force: true });
}

/** Every listing in the work folder (of one type, or all), in id order. */
export function allWork(out: string, type: ProductType | null = null): Work[] {
  return (type ? [type] : PRODUCT_TYPES).flatMap((t) => {
    const base = join(out, t);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) => {
        const dir = join(base, d.name);
        const item = readItem(dir);
        if (!item) return [];
        return [
          {
            dir,
            item,
            result: read(join(dir, 'result.json'), resultSchema),
            decision: read(join(dir, 'decision.json'), decisionSchema),
          },
        ];
      });
  });
}

/** The plan's paging point, so the next `fetch` carries on after the last listing read (one per type, or `all`). */
export const cursorFile = (out: string, type: ProductType | null): string =>
  join(out, `cursor-${type ?? 'all'}.txt`);

/** The words that go out for a listing: the founder's edit, else the model's. */
export const wordsOf = (w: Work): { summary: string; description: string } | null =>
  w.decision?.words ?? w.result?.words ?? null;
