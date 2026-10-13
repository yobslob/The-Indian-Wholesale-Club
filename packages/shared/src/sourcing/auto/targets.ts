import { z } from 'zod';

import { PRODUCT_TYPES } from '../../domain/product-types';

/**
 * Targets from a CSV (D-118), as the state bestseller list is: one row per product with its state, type and
 * category. Columns are found by their heading, so the list can be re-exported from any sheet. Pure, no I/O.
 */

export const targetRowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  query: z.string().trim().min(2).max(120),
  must_match: z.string().trim().max(300).nullable(),
  product_type: z.enum(PRODUCT_TYPES),
  category: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  region: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  tier: z.number().int().min(1).max(3).nullable(),
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
};

export function parseTargetsCsv(text: string): { rows: TargetRow[]; errors: string[] } {
  const [head, ...body] = parseCsv(text);
  if (!head) return { rows: [], errors: ['The file is empty.'] };
  const at = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, re]) => [key, head.findIndex((h) => re.test(h.trim()))]),
  ) as Record<keyof TargetRow, number>;
  const missing = (['name', 'product_type', 'category', 'region'] as const).filter(
    (k) => at[k] < 0,
  );
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
      region: cell('region'),
      tier: Number(cell('tier').match(/^[123]/)?.[0]) || null,
    });
    if (parsed.success) rows.push(parsed.data);
    else
      errors.push(
        `Row ${i + 2} (${name || 'no name'}): ${parsed.error.issues[0]?.path.join('.')} is not valid.`,
      );
  });
  return { rows, errors };
}
