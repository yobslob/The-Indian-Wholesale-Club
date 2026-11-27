import { z } from 'zod';

import { netGrams, netLabel } from '../estimate/food';
import { readNet } from '../net';
import { cleanTitle } from '../title';
import { parseComboParts, parseWeightParts, type WeightParts } from '../weight';

import { checkSourceSchema } from './types';
import { itemKeyOf, listingName } from './listing';

import type { SourcedProduct, SourcedVariant } from '../capture';

/**
 * `pnpm sourcing verify` (founder, 2026-11-27): every listing's own shop pages read once, and what they show decides
 * its stock (the existing check), its pack's weight and its name. Pure, no I/O: the runner reads the pages
 * (tools/sourcing-runner/src/verify.ts) and writes what this decides.
 */

export const verifyPlanSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    status: z.string(),
    product_type: z.string(),
    shop_title: z.string().nullable(),
    sources: z.array(checkSourceSchema.extend({ variant_id: z.string().uuid() })),
    variants: z.array(
      z.object({
        id: z.string().uuid(),
        label: z.string(),
        weight_g: z.number().int().nullable(),
        weight_source: z.string().nullable(),
        net_qty: z.string().nullable().catch(null),
        is_active: z.boolean().catch(true),
      }),
    ),
  }),
);
export type VerifyListing = z.infer<typeof verifyPlanSchema>[number];
export type VerifyVariant = VerifyListing['variants'][number];

/** The pack a page states for one of its items, and where on the page it was read (strongest first). */
export interface PagePack {
  parts: WeightParts[];
  /** As the page wrote it: "900 g", "Net Quantity: 2 x 200 g". */
  text: string;
  /** `pack`: the shop's own pack field; `net`: a net quantity row or line; `title`: only the title's numbers. */
  from: 'pack' | 'net' | 'title';
}

function partsOf(text: string): WeightParts[] | null {
  const combo = parseComboParts(text);
  if (combo) return combo;
  const one = parseWeightParts(text);
  return one && one.unitGrams >= 1 ? [one] : null;
}

const NET_ROW = /^\s*net\s*(quantity|qty|weight|wt\.?|content|contents)\s*$/i;

/**
 * The pack of `item` (one of the page's items; null for a page of one item) as the page states it. A page of several
 * items lends its spec rows, words and title to none of them: they describe the item it opened on.
 */
export function pagePack(product: SourcedProduct, item: SourcedVariant | null): PagePack | null {
  if (item && product.variants.length && item.weightG) {
    const parts = partsOf(item.label) ??
      partsOf(String(item.options.pack ?? '')) ?? [{ unitGrams: item.weightG, count: 1, liquid: false }];
    return { parts, text: item.label, from: 'pack' };
  }
  // the item the page opened on may use the page's rows (Amazon's flavours: the shown one's "Net Quantity")
  const opened = !item || item.key === itemKeyOf(product.url) || item.url === product.url;
  if (product.variants.length > 1 && !opened) return null;
  const own = product.pack ? partsOf(product.pack) : null;
  if (own) return { parts: own, text: product.pack!, from: 'pack' };
  const row = product.specs.find(([k]) => NET_ROW.test(k));
  const rowParts = row ? partsOf(row[1]) : null;
  if (rowParts) return { parts: rowParts, text: `${row![0]}: ${row![1]}`.slice(0, 80), from: 'net' };
  const said = readNet([...product.bullets, product.description].join('\n'));
  if (said) return { parts: said, text: netLabel(said), from: 'net' };
  const titled = partsOf(product.title);
  return titled ? { parts: titled, text: product.title.slice(0, 80), from: 'title' } : null;
}

export type WeightVerdict = 'ok' | 'fix' | 'check' | 'kept' | 'no pack';

export interface WeightCheck {
  verdict: WeightVerdict;
  /** The page's grams (millilitres by density, as D-135 prices them). */
  grams: number | null;
  /** For worker_set_food_weights when the verdict is `fix`. */
  write: { variant_id: string; weight_g: number; note: string; net_qty: string } | null;
}

/**
 * One option's weight against its page: `ok` within 3% (or 2 g), `fix` when the shop's own pack field or net quantity
 * says otherwise (written with --fix-weights), `check` when only the title's numbers do (never written: a title's
 * "27g" may still be a claim), `kept` when the hub weighed it or an admin typed it (never changed), `no pack`.
 */
export function checkWeight(name: string, variant: VerifyVariant, pack: PagePack | null, site: string): WeightCheck {
  if (!pack) return { verdict: 'no pack', grams: null, write: null };
  const grams = netGrams(pack.parts, name);
  if (grams < 1 || grams > 30_000) return { verdict: 'no pack', grams: null, write: null };
  const stored = variant.weight_g;
  const close = stored !== null && Math.abs(stored - grams) <= Math.max(2, grams * 0.03);
  if (close) return { verdict: 'ok', grams, write: null };
  if (variant.weight_source === 'weighed' || variant.weight_source === 'admin')
    return { verdict: 'kept', grams, write: null };
  if (pack.from === 'title') return { verdict: 'check', grams, write: null };
  return {
    verdict: 'fix',
    grams,
    write: {
      variant_id: variant.id,
      weight_g: grams,
      note: `${netLabel(pack.parts)} net (${site}: ${pack.text}) (verify, D-202)`.slice(0, 200),
      net_qty: netLabel(pack.parts),
    },
  };
}

/**
 * The name a food listing would have from its shop title by today's rules, when its name is a cut of it
 * ("Samrat" → "Samrat Bikaneri Sev"): only a longer name that starts with the one it has, so a name an admin wrote is
 * never touched. Null: keep it.
 */
export function nameFromTitle(name: string, title: string | null, brand: string | null): string | null {
  if (!title) return null;
  const next = listingName(cleanTitle(title, { brand, productType: 'food' }), brand);
  const n = name.trim().toLowerCase();
  return next.length > name.trim().length && next.toLowerCase().startsWith(n) && next.length <= 120 ? next : null;
}
