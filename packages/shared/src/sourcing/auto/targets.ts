import { z } from 'zod';

import { PRODUCT_TYPES } from '../../domain/product-types';

/**
 * Targets from a CSV (D-118), as the state bestseller list is: one row per product with its state, type and
 * category. Columns are found by their heading, so the list can be re-exported from any sheet. Pure, no I/O.
 * D-121: the state may be empty or "all" (the listings carry no state and fill every state's page), and a row may
 * name its shops ("myntra"), a price band in rupees and how many listings to make.
 */

export const targetRowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  query: z.string().trim().min(2).max(120),
  must_match: z.string().trim().max(300).nullable(),
  product_type: z.enum(PRODUCT_TYPES),
  category: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  region: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .nullable(),
  tier: z.number().int().min(1).max(3).nullable(),
  /** Shop names or hosts as typed ("myntra", "amazon.in"); the upload matches them to the shops. */
  shops: z
    .array(z.string().regex(/^[a-z0-9.-]{2,60}$/))
    .max(12)
    .nullable(),
  min_price_paise: z.number().int().positive().nullable(),
  max_price_paise: z.number().int().positive().nullable(),
  listings: z.number().int().min(1).max(40).nullable(),
});
export type TargetRow = z.infer<typeof targetRowSchema>;

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const COLUMNS: Record<keyof TargetRow, RegExp> = {
  name: /^(product|name|target)$/i,
  query: /^(search words|search|query)$/i,
  must_match: /^(must match|match)$/i,
  product_type: /^type$/i,
  category: /^(iwc category|category)$/i,
  region: /^(iwc region slug|region|state slug)$/i,
  tier: /^tier$/i,
  shops: /^(shops?|sites?)$/i,
  min_price_paise: /^(min|min price|min ₹|min rs|from ₹)$/i,
  max_price_paise: /^(max|max price|max ₹|max rs|to ₹)$/i,
  listings: /^(listings|how many)$/i,
};

/** "", "all", "all states" or "india": no state (D-121). */
const ALL_STATES = /^(|all|all states|india|all india)$/i;
/** Rupees as typed ("₹600", "1,600") → paise; empty → null; anything else → NaN (the row is refused). */
const rupees = (text: string): number | null => {
  const t = text.replace(/[₹,\s]|rs\.?/gi, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : Number.NaN;
};

export function parseTargetsCsv(text: string): { rows: TargetRow[]; errors: string[] } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { rows: [], errors: ['The file is empty.'] };
  const at = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, re]) => [key, head.findIndex((h) => re.test(h.trim()))]),
  ) as Record<keyof TargetRow, number>;
  const missing = (['name', 'product_type', 'category'] as const).filter((k) => at[k] < 0);
  if (missing.length) return { rows: [], errors: [`Missing column: ${missing.join(', ')}.`] };
  const rows: TargetRow[] = [];
  const errors: string[] = [];
  body.forEach((r, i) => {
    const cell = (k: keyof TargetRow) => (at[k] >= 0 ? (r[at[k]] ?? '').trim() : '');
    const name = cell('name');
    const parsed = targetRowSchema.safeParse({
      name,
      query:
        cell('query') ||
        name
          .replace(/\(.*?\)/g, '')
          .replace(/\s+/g, ' ')
          .trim(),
      must_match: cell('must_match') || null,
      product_type: cell('product_type').toLowerCase(),
      category: cell('category'),
      region: ALL_STATES.test(cell('region')) ? null : cell('region'),
      tier: Number(cell('tier').match(/^[123]/)?.[0]) || null,
      shops: cell('shops')
        ? cell('shops')
            .toLowerCase()
            .split(/[;|\s]+/)
            .map((x) =>
              x
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/.*$/, ''),
            )
            .filter(Boolean)
        : null,
      min_price_paise: rupees(cell('min_price_paise')),
      max_price_paise: rupees(cell('max_price_paise')),
      listings: cell('listings') ? Number(cell('listings')) : null,
    });
    if (parsed.success) rows.push(parsed.data);
    else
      errors.push(
        `Row ${i + 2} (${name || 'no name'}): ${parsed.error.issues[0]?.path.join('.')} is not valid.`,
      );
  });
  return { rows, errors };
}

/**
 * D-150: a target uploaded again adds the row's shops to the one already there (the 7-day targets, Blinkit only,
 * taking BigBasket, Zepto and Instamart). Never fewer shops: a target on every shop (null) stays so, and a row
 * without Shops changes nothing. Returns the wider list, or null when nothing changes.
 */
export function widenedSites(had: string[] | null, row: string[] | null): string[] | null {
  if (had === null || row === null) return null;
  const more = row.filter((s) => !had.includes(s));
  return more.length ? [...had, ...new Set(more)] : null;
}
