import { variantLabel, type VariantOptions } from '../domain/listing';
import { OPTION_KEYS, type OptionKey } from '../domain/variant-options';

import { oneLine, parseRupeesToPaise } from './text';

import type { RawCapture, SourcedVariant } from './capture';

/**
 * A product page's items as variants (D-118): Amazon's variation picker, Myntra's sizes, Flipkart's option links,
 * Shopify's variants. Each shop names its options its own way ("flavor_name", "Size", "Colour"); they become IWC's
 * option keys (domain/variant-options.ts) so the product page shows one row per option.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

const QUANTITY =
  /^\s*(pack of \d+|set of \d+|\d+(\.\d+)?\s*(g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|litre|liter|pcs|pc|pieces|piece|units?|count|n)\b|\d+\s*[x×]\s*\d+)/i;

/** "500 g", "Pack of 2", "2 x 200 g": a pack size, not a flavour or a clothing size. */
export const isQuantity = (value: string): boolean => QUANTITY.test(value);

/** The IWC option a shop's option name stands for, from its name and, for pack sizes, its values. */
export function optionKeyFor(name: string, values: string[] = []): OptionKey {
  const n = name.toLowerCase().replace(/[_-]+/g, ' ');
  if (values.length > 0 && values.every(isQuantity)) return 'pack';
  if (/colou?r|shade/.test(n)) return 'colour';
  if (/flavou?r|taste/.test(n)) return 'flavour';
  if (/\bsize\b/.test(n)) return 'size';
  if (/weight|pack|quantity|net qty|count/.test(n)) return 'pack';
  return 'style';
}

/** Grams in a pack ("500 g", "1 kg", "2 x 200 g", "200 ml" counts as 200 g). Null when it says none. */
export function packGrams(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, '');
  const m = t.match(
    /(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|g\b|gm|gms|gram|grams|ml|l\b|ltr|litre|liter)/,
  );
  if (!m) return null;
  const unit = m[3]!;
  const each = Number(m[2]) * (/^(kg|kgs|kilo|l|ltr|litre|liter)$/.test(unit) ? 1000 : 1);
  const grams = each * (m[1] ? Number(m[1]) : 1);
  return grams > 0 && grams <= 50_000 ? Math.round(grams) : null;
}

/** Only IWC's option keys, trimmed and capped (anything else could reach customers: D-003). */
export function cleanOptions(options: Partial<Record<string, string>>): VariantOptions {
  const out: VariantOptions = {};
  for (const key of OPTION_KEYS) {
    const value = oneLine(options[key] ?? '').slice(0, 40);
    if (value) out[key] = value;
  }
  return out;
}

function variant(
  key: string,
  url: string,
  options: VariantOptions,
  price: number | null,
  mrp: number | null,
  inStock: boolean | null,
  image: string | null = null,
): SourcedVariant {
  const label = variantLabel(options).slice(0, 80);
  return {
    key: key.slice(0, 200),
    url,
    label,
    options,
    pricePaise: price,
    mrpPaise: mrp && price && mrp >= price ? mrp : null,
    inStock,
    weightG: options.pack ? packGrams(options.pack) : null,
    image: image && /^https:\/\//.test(image) ? image.slice(0, 2000) : null,
  };
}

/** Amazon: every ASIN of the picker with its option values; prices from the swatches that show one. */
export function amazonVariants(
  a: NonNullable<RawCapture['amazon']>,
  site: string,
  pagePrice: number | null,
  pageInStock: boolean | null,
): SourcedVariant[] {
  const t = a.twister;
  if (!t?.values || !t.dims?.length) return [];
  const asins = Object.keys(t.values).filter((x) => /^[A-Z0-9]{10}$/.test(x));
  const keys = t.dims.map((dim, i) =>
    optionKeyFor(t.labels?.[dim] ?? dim, asins.map((x) => t.values![x]?.[i] ?? '').filter(Boolean)),
  );
  if (new Set(keys).size !== keys.length) return [];
  const swatch = new Map((t.swatches ?? []).map((s) => [s.asin, s]));
  return asins.slice(0, 60).map((asin) => {
    const options = cleanOptions(
      Object.fromEntries(keys.map((k, i) => [k, t.values![asin]?.[i] ?? ''])),
    );
    const s = swatch.get(asin);
    const own = asin === a.asin;
    const price = own ? pagePrice : parseRupeesToPaise(s?.price);
    return variant(
      asin,
      `https://www.${site}/dp/${asin}`,
      options,
      price,
      parseRupeesToPaise(s?.mrp),
      own ? pageInStock : s ? s.available !== false && price !== null : null,
    );
  });
}

/** Myntra: one variant per size (its sku), with the size's own price when Myntra shows one. */
export function myntraVariants(p: Obj, url: string, pagePrice: number | null): SourcedVariant[] {
  const colour = str(p.baseColour);
  const sizes = Array.isArray(p.sizes) ? p.sizes.filter(isObj) : [];
  return sizes.slice(0, 60).flatMap((s) => {
    const label = oneLine(str(s.label));
    const sku = str(s.skuId);
    if (!label || !sku) return [];
    const seller = Array.isArray(s.sizeSellerData) ? s.sizeSellerData.find(isObj) : undefined;
    const price = parseRupeesToPaise(seller?.discountedPrice ?? s.price) ?? pagePrice;
    const free = /^(one ?size|onesize|free ?size|freesize)$/i.test(label);
    return [
      variant(
        `sku:${sku}`,
        url,
        cleanOptions({ colour, size: free ? '' : label }),
        price,
        parseRupeesToPaise(seller?.mrp),
        s.available !== false,
      ),
    ];
  });
}

/** Flipkart: the page's own item (its pid) and the other values' pages, priced when the runner reads them. */
export function swatchVariants(
  swatch: NonNullable<RawCapture['swatch']>,
  pageUrl: string,
  price: number | null,
  mrp: number | null,
  inStock: boolean | null,
): SourcedVariant[] {
  const pidOf = (u: string): string | null => {
    try {
      return new URL(u, pageUrl).searchParams.get('pid');
    } catch {
      return null;
    }
  };
  const selected = (swatch.selected ?? []).map(([axis, value]) => [axis, oneLine(value)] as const);
  if (!selected.length) return [];
  const keyOf = (axis: string, value: string) => optionKeyFor(axis, [value]);
  const own = pidOf(pageUrl);
  const current = cleanOptions(
    Object.fromEntries(selected.map(([axis, v]) => [keyOf(axis, v), v])),
  );
  const out = own ? [variant(own, pageUrl, current, price, mrp, inStock)] : [];
  const seen = new Set(own ? [own] : []);
  for (const link of swatch.links ?? []) {
    const pid = pidOf(link.url);
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    const value = oneLine(link.label.replace(/\(.*?\)/g, ''));
    const axis = link.axis ?? selected[0]![0];
    const options = cleanOptions({ ...current, [keyOf(axis, value)]: value });
    const url = new URL(link.url, pageUrl);
    out.push(
      variant(pid, `https://www.flipkart.com${url.pathname}?pid=${pid}`, options, null, null, null),
    );
  }
  return out.slice(0, 60);
}

/** Shopify's product JSON (/products/<handle>.js, or ShopifyAnalytics' copy): prices are in paise there. */
export function shopifyVariants(product: unknown, pageUrl: string): SourcedVariant[] {
  if (!isObj(product) || !Array.isArray(product.variants)) return [];
  const names = Array.isArray(product.options)
    ? product.options.map((o) => (isObj(o) ? str(o.name) : str(o)))
    : [];
  const variants = product.variants.filter(isObj);
  const keys = names.map((name, i) =>
    optionKeyFor(name, variants.map((v) => str(v[`option${i + 1}`])).filter(Boolean)),
  );
  const base = pageUrl.replace(/[?#].*$/, '');
  return variants.slice(0, 60).flatMap((v) => {
    const id = str(v.id);
    if (!id) return [];
    const options =
      names.length && new Set(keys).size === keys.length
        ? cleanOptions(Object.fromEntries(keys.map((k, i) => [k, str(v[`option${i + 1}`])])))
        : cleanOptions({ style: str(v.public_title) });
    const minor = (x: unknown) =>
      typeof x === 'number' && x > 0 ? Math.round(x) : parseRupeesToPaise(x);
    const image = isObj(v.featured_image) ? str(v.featured_image.src) : '';
    return [
      variant(
        id,
        `${base}?variant=${id}`,
        /default title/i.test(options.style ?? '') ? {} : options,
        minor(v.price),
        minor(v.compare_at_price),
        typeof v.available === 'boolean' ? v.available : null,
        image.replace(/^\/\//, 'https://') || null,
      ),
    ];
  });
}
