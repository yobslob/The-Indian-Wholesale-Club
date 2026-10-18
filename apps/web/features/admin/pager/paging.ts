/**
 * The admin pager's arithmetic (D-140, F10): pages of 25, 50 or 100, the page from the address, the numbers shown
 * with gaps (1 2 3 … 68 69) and the "1–50 of 3,412" line. Pure, so it is unit-tested.
 */

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 50;

/** The cookie that remembers one list's page size. */
export const sizeCookie = (list: string): string => `admin-size-${list}`;

export function parsePageSize(...candidates: (string | undefined | null)[]): PageSize {
  for (const c of candidates) {
    const n = Number(c);
    const size = PAGE_SIZES.find((s) => s === n);
    if (size) return size;
  }
  return DEFAULT_PAGE_SIZE;
}

/** A 1-based page from the address; anything else is page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(String(Array.isArray(value) ? value[0] : (value ?? '1')), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/** The page numbers to show: the first two, the last two and two either side of the current one, gaps between. */
export function pageWindow(page: number, pages: number): (number | 'gap')[] {
  const keep = new Set<number>();
  for (const n of [1, 2, pages - 1, pages, page - 2, page - 1, page, page + 1, page + 2])
    if (n >= 1 && n <= pages) keep.add(n);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && n - prev > 2) out.push('gap');
    out.push(n);
  });
  return out;
}

const count = new Intl.NumberFormat('en-US');

/** "1–50 of 3,412", "None". */
export function rangeLabel(page: number, size: number, total: number): string {
  if (total <= 0) return 'None';
  const from = Math.min((page - 1) * size + 1, total);
  const to = Math.min(page * size, total);
  return `${count.format(from)}–${count.format(to)} of ${count.format(total)}`;
}

/** An address for page `n` of a list, keeping its other parameters; page 1 has no `page`. */
export function pageHref(path: string, params: Record<string, string>, n: number, param = 'page'): string {
  const sp = new URLSearchParams(params);
  sp.delete(param);
  if (n > 1) sp.set(param, String(n));
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}

/** The address's parameters as plain strings (the first of repeated ones), minus empty ones. */
export function plainParams(params: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s !== undefined && s !== '') out[k] = s;
  }
  return out;
}
