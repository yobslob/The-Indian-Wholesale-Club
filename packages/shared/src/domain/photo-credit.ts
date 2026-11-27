import { z } from 'zod';

import { slugFromFileName } from './recipe-drafts';

/**
 * D-214 (founder, 2026-11-27: "Yes, with credits"): an openly licensed recipe photo (Openverse: Flickr, Wikimedia
 * Commons) is shown with its credit, as CC BY and BY-SA ask: its title, author, where it is published and its licence.
 * The recipe photo runner writes them to credits.csv; Add photos by name stores each with its photo.
 */
const https = z.string().url().max(500).startsWith('https://');

export const photoCreditSchema = z.object({
  title: z.string().trim().max(120).nullable(),
  author: z.string().trim().min(1).max(120),
  source_url: https,
  /** "CC BY-SA 4.0", "CC0 1.0", "Public Domain Mark 1.0". */
  licence: z.string().trim().min(2).max(40),
  licence_url: https.nullable(),
});
export type PhotoCredit = z.infer<typeof photoCreditSchema>;

/** One CSV text as rows of cells ("…" quoted, "" inside a quote is one "). */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

/** A licence that asks for (or is shown with) a credit: Creative Commons and the public domain; Pixabay's and Pexels' do not. */
const CREDITED = /^(cc\b|cc0|cc by|public domain)/i;

/**
 * The recipe photo runner's credits.csv (slug,name,source,id,title,author,page,licences) as each recipe's credit, by
 * slug; a later row for a slug replaces an earlier one (a photo picked again). Rows whose licence asks for no credit,
 * or that don't make a valid credit, are left out.
 */
export function creditsFromCsv(text: string): Map<string, PhotoCredit> {
  const rows = csvRows(text);
  const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const at = (name: string) => head.indexOf(name);
  const out = new Map<string, PhotoCredit>();
  for (const cells of rows.slice(1)) {
    const get = (name: string) => (at(name) >= 0 ? (cells[at(name)] ?? '').trim() : '');
    // "CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/" (the first, when several)
    const first = get('licences').split(' | ')[0] ?? '';
    const sep = first.indexOf(': ');
    const licence = (sep >= 0 ? first.slice(0, sep) : first).trim();
    const licenceUrl = sep >= 0 ? first.slice(sep + 2).trim() : '';
    if (!CREDITED.test(licence)) continue;
    const credit = photoCreditSchema.safeParse({
      title: get('title').slice(0, 120) || null,
      author: get('author').slice(0, 120),
      source_url: get('page'),
      licence,
      licence_url: licenceUrl || null,
    });
    const slug = slugFromFileName(get('slug'));
    if (credit.success && slug) out.set(slug, credit.data);
  }
  return out;
}
