import { z } from 'zod';

import { MAX_CARRIED_LINES, MAX_QTY_PER_LINE } from './limits';

/**
 * E-1: a bag carried from the old vercel.app address to the domain in the address fragment, `#bag=<base64url of
 * "variantId:qty,variantId:qty">`. Only ids and quantities (never names or prices: the domain reads those from the
 * store, so a crafted link can't show a false price), and in the fragment, which never reaches a server or a log.
 * The old host's bounce page (lib/legacy-bounce.ts) writes it with the same rules; bag-carry.ts reads it once.
 */
export const BAG_PREFIX = '#bag=';

export interface CarriedLine {
  variantId: string;
  quantity: number;
}

const uuid = z.string().uuid();
const entry = z
  .string()
  .regex(/^[0-9a-f-]{36}:\d{1,3}$/i)
  .transform((e) => ({ variantId: e.slice(0, 36).toLowerCase(), quantity: Number(e.slice(37)) }))
  .pipe(z.object({ variantId: uuid, quantity: z.number().int().min(1) }));

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,4000}$/.test(value)) return null;
  try {
    return atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
}

/** The fragment for a bag (with its `#bag=`), or null for an empty one. Bad lines are left out. */
export function encodeBagFragment(lines: readonly CarriedLine[]): string | null {
  const parts: string[] = [];
  for (const line of lines) {
    if (parts.length >= MAX_CARRIED_LINES) break;
    const quantity = Math.floor(line.quantity);
    if (!uuid.safeParse(line.variantId).success || !(quantity > 0)) continue;
    parts.push(`${line.variantId.toLowerCase()}:${Math.min(quantity, MAX_QTY_PER_LINE)}`);
  }
  return parts.length ? `${BAG_PREFIX}${toBase64Url(parts.join(','))}` : null;
}

/** The lines in a `#bag=` fragment (empty for anything else); each variant once, quantities capped. */
export function decodeBagFragment(hash: string): CarriedLine[] {
  if (!hash.startsWith(BAG_PREFIX)) return [];
  const text = fromBase64Url(hash.slice(BAG_PREFIX.length));
  if (!text) return [];
  const seen = new Map<string, number>();
  for (const raw of text.split(',').slice(0, MAX_CARRIED_LINES)) {
    const parsed = entry.safeParse(raw);
    if (!parsed.success) continue;
    const { variantId, quantity } = parsed.data;
    seen.set(variantId, Math.min(Math.max(seen.get(variantId) ?? 0, quantity), MAX_QTY_PER_LINE));
  }
  return [...seen].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Merging a carried line into the bag: the larger of the two quantities, never their sum, so the same link opened
 * twice can't double the bag.
 */
export function mergedQuantity(inBag: number, carried: number): number {
  return Math.min(Math.max(inBag, carried), MAX_QTY_PER_LINE);
}
