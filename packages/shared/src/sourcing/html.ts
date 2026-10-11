import { decodeEntities, oneLine } from './text';

import type { RawCapture } from './capture';

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : null;
};

/** The JSON object that starts at `from` in `text` (balanced braces, strings respected), or null. */
function jsonObjectAt(text: string, from: number): string | null {
  const start = text.indexOf('{', from);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

/**
 * The same capture the bookmarklet makes, from a page's HTML fetched by the server ("Paste links"). Works for shops
 * that serve their product data in the page (JSON-LD, meta tags, Myntra's __myx); shops that block servers return a
 * page without it, and the importer asks for the button instead.
 */
export function captureFromHtml(html: string, url: string): RawCapture {
  const capture: RawCapture = { v: 1, url, meta: {}, ld: [] };
  capture.title = oneLine(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 1000);
  for (const tag of html.match(/<link\s[^>]*>/gi) ?? []) {
    if (/rel\s*=\s*["']canonical["']/i.test(tag))
      capture.canonical = attr(tag, 'href')?.slice(0, 2000) ?? undefined;
  }
  for (const tag of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const key = attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop');
    const value = attr(tag, 'content');
    if (!key || !value || !/^(og:|product:|description$|price|pricecurrency)/i.test(key)) continue;
    const list = (capture.meta![key] ??= []);
    if (list.length < 20) list.push(value.slice(0, 2000));
  }
  for (const m of html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    if (/product/i.test(m[1]!) && capture.ld!.length < 12) capture.ld!.push(m[1]!.slice(0, 80_000));
  }
  const myx = html.indexOf('window.__myx');
  if (myx >= 0) {
    try {
      const data = JSON.parse(jsonObjectAt(html, myx) ?? 'null') as { pdpData?: unknown } | null;
      if (data?.pdpData) capture.myntra = data.pdpData;
    } catch {
      // not the shape we know
    }
  }
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) capture.dom = { h1: oneLine(h1.replace(/<[^>]+>/g, ' ')).slice(0, 1000) };
  return capture;
}

/** A shop's "are you a robot?" or access-denied page instead of the product. */
export function looksBlocked(html: string): boolean {
  return /captcha|robot check|access denied|request blocked|enable javascript and cookies|pardon our interruption/i.test(
    html.slice(0, 20_000),
  );
}
