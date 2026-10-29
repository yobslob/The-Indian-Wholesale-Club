import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import type { ProductType } from '@repo/shared/domain';

/**
 * The redo's work, one folder per photo under out/<type>/<media id>/, so any step can stop and carry on:
 *   item.json      what the photo is (written by `fetch`, then `publish` adds what it did)
 *   before.png     the photo as customers see it now (its 1200 copy)
 *   after.png      the new photo, result.json what the GPU step found (tools/photo-worker/redo.py)
 *   decision.json  the founder's approve or reject (the review page)
 * Each file has one writer.
 */

export const itemSchema = z.object({
  media_id: z.string().uuid(),
  product_id: z.string().uuid(),
  type: z.enum(['clothing', 'food', 'home']),
  name: z.string(),
  category: z.string(),
  wears: z.string().nullable(),
  path: z.string(),
  alt: z.string(),
  main: z.boolean(),
  /** Set by `publish`: the new path (null for a kept photo), when, and the replaced photo whose copies the sweep
   * deletes (null when none is replaced: kept, or home's plain photo that stays second). */
  published: z
    .object({
      path: z.string().nullable(),
      at: z.string(),
      redo: z.string(),
      old_path: z.string().nullable(),
      swept: z.boolean().optional(),
    })
    .optional(),
  /** Set by `publish` when the listing changed the photo meanwhile: left alone. */
  stale: z.boolean().optional(),
});
export type Item = z.infer<typeof itemSchema>;

export const resultSchema = z.object({
  /** made: after.png is ready; none: nothing to change (no person in a clothing photo); failed: see note. */
  status: z.enum(['made', 'none', 'failed']),
  note: z.string().default(''),
  /** The automatic checks passed (a face really changed, the product untouched…): `publish --auto` takes it. */
  pass: z.boolean().default(false),
  checks: z.record(z.string(), z.union([z.number(), z.boolean(), z.string()])).default({}),
  house_model: z.string().nullable().default(null),
  /** What was done (D-164): face (drawn again), crop (cut under the chin), fresh (the light refresh), scene. Results
   * made before it have none: clothing's were faces, food's and home's scenes. */
  mode: z.enum(['face', 'crop', 'fresh', 'scene']).optional(),
});
export type Result = z.infer<typeof resultSchema>;

/** The founder's choice: `remove` takes the photo off the listing (a portrait whose face cannot be cut away). */
export const decisionSchema = z.object({ ok: z.boolean(), at: z.string(), remove: z.boolean().optional() });

export interface Work {
  dir: string;
  item: Item;
  result: Result | null;
  decision: z.infer<typeof decisionSchema> | null;
}

const read = <S extends z.ZodTypeAny>(file: string, schema: S): z.output<S> | null => {
  if (!existsSync(file)) return null;
  try {
    return schema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
};

export const typeDir = (out: string, type: ProductType): string => join(out, type);

export function itemDir(out: string, item: Pick<Item, 'type' | 'media_id'>): string {
  return join(out, item.type, item.media_id);
}

export function writeItem(dir: string, item: Item): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'item.json'), `${JSON.stringify(item, null, 2)}\n`);
}

export function writeDecision(dir: string, ok: boolean, remove = false): void {
  const decision = { ok, at: new Date().toISOString(), ...(remove ? { remove } : {}) };
  writeFileSync(join(dir, 'decision.json'), `${JSON.stringify(decision)}\n`);
}

/** What a made photo is, for the database's mark and the way it goes live. */
export function modeOf(w: Work): 'face' | 'crop' | 'fresh' | 'scene' {
  return w.result?.mode ?? (w.item.type === 'clothing' ? 'face' : 'scene');
}

/** Every photo of a type in the work folder, a listing's photos together (its main photo first). */
export function allWork(out: string, type: ProductType): Work[] {
  const base = typeDir(out, type);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const dir = join(base, d.name);
      const item = read(join(dir, 'item.json'), itemSchema);
      if (!item) return [];
      return [
        {
          dir,
          item,
          result: read(join(dir, 'result.json'), resultSchema),
          decision: read(join(dir, 'decision.json'), decisionSchema),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.item.product_id.localeCompare(b.item.product_id) ||
        Number(b.item.main) - Number(a.item.main) ||
        a.item.path.localeCompare(b.item.path),
    );
}

/** The plan's paging point, so the next `fetch` carries on after the last listing read. */
export const cursorFile = (out: string, type: ProductType): string => join(typeDir(out, type), 'cursor.txt');
