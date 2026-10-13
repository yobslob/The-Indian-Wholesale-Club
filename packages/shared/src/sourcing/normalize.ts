import { sourcedProductSchema, type RawCapture, type SourcedProduct } from './capture';
import { htmlToText, oneLine, parseRupeesToPaise } from './text';
import { cleanSourceUrl, siteOf } from './url';
import { amazonVariants, myntraVariants, shopifyVariants, swatchVariants } from './variants';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

/** Indian shops price in rupees even when the page doesn't say so. */
const INDIAN_SITE = /(\.in$|myntra|flipkart|ajio|nykaa|meesho|tatacliq|jiomart|bigbasket|snapdeal)/;

// ---------------------------------------------------------------- JSON-LD (schema.org Product, on most shops)

function ldProducts(blocks: string[]): Obj[] {
  const found: Obj[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!isObj(node)) return;
    const types = asArray(node['@type']).map(str);
    if (types.some((t) => t === 'Product' || t === 'ProductGroup')) found.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  for (const block of blocks) {
    try {
      visit(JSON.parse(block.trim().replace(/^<!--|-->$/g, '')));
    } catch {
      // a shop's broken JSON-LD: the other sources still count
    }
  }
  return found;
}

function ldImages(product: Obj): string[] {
  return asArray(product.image).map((img) =>
    isObj(img) ? str(img.url ?? img.contentUrl) : str(img),
  );
}

function ldOffer(product: Obj): {
  price: number | null;
  currency: string | null;
  inStock: boolean | null;
} {
  const offers = asArray(product.offers)
    .flatMap((o) => (isObj(o) && o.offers ? asArray(o.offers) : [o]))
    .filter(isObj);
  const first = offers.find((o) => o.price !== undefined || o.lowPrice !== undefined);
  if (!first) return { price: null, currency: null, inStock: null };
  const availability = str(first.availability);
  return {
    price: parseRupeesToPaise(first.price ?? first.lowPrice),
    currency: str(first.priceCurrency) || null,
    inStock: availability ? /InStock|LimitedAvailability|PreOrder/i.test(availability) : null,
  };
}

// ---------------------------------------------------------------- Myntra (window.__myx.pdpData)

/** Myntra's photo addresses are templates: "h_($height),q_($qualityPercentage),w_($width)". */
const myntraImage = (url: string): string =>
  url
    .replace(/^http:/, 'https:')
    .replace('($height)', '1440')
    .replace('($qualityPercentage)', '90')
    .replace('($width)', '1080');

function fromMyntra(p: Obj, out: Partial<SourcedProduct>): void {
  out.title = str(p.name) || out.title;
  out.brand = (isObj(p.brand) ? str(p.brand.name) : str(p.brand)) || out.brand || null;
  const price = isObj(p.price) ? p.price : {};
  out.pricePaise =
    parseRupeesToPaise(price.discounted ?? price.mrp ?? p.mrp) ?? out.pricePaise ?? null;
  out.mrpPaise = parseRupeesToPaise(price.mrp ?? p.mrp) ?? out.mrpPaise ?? null;
  out.currency = 'INR';
  const albums = asArray(isObj(p.media) ? p.media.albums : undefined).filter(isObj);
  const album = albums.find((a) => str(a.name) === 'default') ?? albums[0];
  const images = asArray(album?.images)
    .filter(isObj)
    .map((i) => myntraImage(str(i.secureSrc) || str(i.imageURL) || str(i.src)));
  if (images.length) out.images = images;
  const details = asArray(p.productDetails).filter(isObj);
  const text = details
    .map((d) => [oneLine(str(d.title)), htmlToText(str(d.description))].filter(Boolean).join('\n'))
    .filter(Boolean);
  if (text.length) out.description = text.join('\n\n');
  if (isObj(p.articleAttributes)) {
    out.specs = Object.entries(p.articleAttributes)
      .map(([k, v]) => [oneLine(k), oneLine(str(v))] as [string, string])
      .filter(([k, v]) => k && v && v.toUpperCase() !== 'NA');
  }
  const care = details.find((d) => /material|care/i.test(str(d.title)));
  if (care)
    out.specs = [
      ...(out.specs ?? []),
      ['Material & Care', htmlToText(str(care.description)).replace(/\n+/g, '; ')],
    ];
  const sizes = asArray(p.sizes)
    .filter(isObj)
    .map((s) => ({ label: oneLine(str(s.label)), available: s.available !== false }))
    .filter((s) => s.label);
  if (sizes.length) {
    out.sizes = sizes;
    out.inStock = sizes.some((s) => s.available);
  }
  const a = isObj(p.analytics) ? p.analytics : {};
  out.hints = [str(a.articleType), str(a.subCategory), str(a.masterCategory), str(a.gender)].filter(
    Boolean,
  );
}

// ---------------------------------------------------------------- Amazon (read off the page by the bookmarklet)

/** Amazon photo addresses carry a size code ("._SX679_."); without it they are the full-size photo. */
const amazonFullSize = (url: string): string =>
  url.replace(/\._[^/]*?_\.(jpe?g|png|webp)$/i, '.$1');

function fromAmazon(a: NonNullable<RawCapture['amazon']>, out: Partial<SourcedProduct>): void {
  out.title = oneLine(a.title ?? '') || out.title;
  const byline = oneLine(a.byline ?? '');
  const brand =
    byline.match(/^Brand:\s*(.+)$/i)?.[1] ?? byline.match(/^Visit the (.+?) Store$/i)?.[1];
  out.brand = brand ?? out.brand ?? null;
  out.pricePaise = parseRupeesToPaise(a.price) ?? out.pricePaise ?? null;
  out.mrpPaise = parseRupeesToPaise(a.mrp) ?? out.mrpPaise ?? null;
  out.currency = 'INR';
  if (a.availability)
    out.inStock = !/unavailable|out of stock|currently not available/i.test(a.availability);
  out.bullets = (a.bullets ?? []).map(oneLine).filter(Boolean);
  out.description =
    [a.description ?? '', a.important ?? '']
      .map((t) => t.trim())
      .filter(Boolean)
      .join('\n\n') || out.description;
  out.specs = (a.specs ?? []).map(
    ([k, v]) =>
      [oneLine(k).replace(/[‏‎]/g, ''), oneLine(v).replace(/[‏‎]/g, '')] as [string, string],
  );
  const images = (a.images ?? []).map(amazonFullSize);
  if (images.length) out.images = images;
  if (a.size) out.sizes = [{ label: oneLine(a.size), available: out.inStock !== false }];
  if (!out.brand) out.brand = out.specs.find(([k]) => /^brand$/i.test(k))?.[1] ?? null;
}

// ---------------------------------------------------------------- everything together

const unique = (urls: string[]): string[] => {
  const seen = new Set<string>();
  return urls.filter((u) => {
    const key = u.replace(/[?#].*$/, '');
    if (!/^https:\/\//.test(u) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * The capture as one product. The shop's own data wins (Myntra's pdpData, Amazon's page), then schema.org JSON-LD,
 * then the page's meta tags, then its big photos. Null when there is nothing that looks like a product.
 */
export function normalizeCapture(raw: RawCapture): SourcedProduct | null {
  let url: string;
  try {
    const canonical =
      raw.canonical && siteOf(raw.canonical) === siteOf(raw.url) ? raw.canonical : raw.url;
    url = cleanSourceUrl(canonical);
  } catch {
    return null;
  }
  const site = siteOf(url) ?? '';
  const meta = (key: string): string => raw.meta?.[key]?.[0] ?? '';
  const out: Partial<SourcedProduct> = {
    brand: null,
    pricePaise: null,
    mrpPaise: null,
    currency: null,
    inStock: null,
  };

  // meta tags first, so better sources overwrite them
  out.title = meta('og:title') || raw.dom?.h1 || raw.title || '';
  out.description = meta('og:description') || meta('description');
  out.images = raw.meta?.['og:image'] ?? [];
  out.pricePaise = parseRupeesToPaise(
    meta('product:price:amount') || meta('og:price:amount') || meta('price'),
  );
  out.currency =
    meta('product:price:currency') || meta('og:price:currency') || meta('priceCurrency') || null;

  const products = ldProducts(raw.ld ?? []);
  const ld = products.find((p) => str(p.name)) ?? products[0];
  if (ld) {
    out.title = oneLine(str(ld.name)) || out.title;
    out.description = htmlToText(str(ld.description)) || out.description;
    out.brand = (isObj(ld.brand) ? str(ld.brand.name) : str(ld.brand)) || null;
    const images = ldImages(ld);
    if (images.length) out.images = images;
    let offer = ldOffer(ld);
    const variants = asArray(ld.hasVariant).filter(isObj);
    if (offer.price === null && variants[0]) offer = ldOffer(variants[0]);
    out.pricePaise = offer.price ?? out.pricePaise;
    out.currency = offer.currency ?? out.currency;
    out.inStock = offer.inStock;
    const sizes = variants
      .map((v) => ({
        label: oneLine(
          str(v.size) ||
            str(v.name)
              .split(/[-–/|]/)
              .pop() ||
            '',
        ),
        available: ldOffer(v).inStock !== false,
      }))
      .filter((s) => s.label && s.label.length <= 40);
    if (sizes.length) out.sizes = sizes;
    const category = oneLine(str(ld.category));
    if (category) out.hints = [category];
    // quick-commerce shops put "Key Features", "Shelf Life", "Ingredients" here
    out.specs = asArray(ld.additionalProperty)
      .filter(isObj)
      .map((p) => [oneLine(str(p.name)), htmlToText(str(p.value))] as [string, string]);
  }
  if (isObj(raw.myntra)) fromMyntra(raw.myntra, out);
  if (raw.amazon) fromAmazon(raw.amazon, out);
  if (!out.images?.length && raw.dom?.images) out.images = raw.dom.images;

  const price = out.pricePaise ?? null;
  const variants = raw.amazon
    ? amazonVariants(raw.amazon, site, price, out.inStock ?? null)
    : isObj(raw.myntra)
      ? myntraVariants(raw.myntra, url, price)
      : raw.swatch
        ? swatchVariants(raw.swatch, url, price, out.mrpPaise ?? null, out.inStock ?? null)
        : raw.shopify
          ? shopifyVariants(raw.shopify, url)
          : [];

  if (!out.currency && INDIAN_SITE.test(site)) out.currency = 'INR';
  const product = {
    url,
    site,
    title: oneLine(out.title ?? '').slice(0, 300),
    brand: out.brand ? oneLine(out.brand).slice(0, 120) : null,
    description: (out.description ?? '').trim().slice(0, 8000),
    bullets: (out.bullets ?? []).map((b) => b.slice(0, 1000)).slice(0, 20),
    specs: (out.specs ?? [])
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k.slice(0, 200), v.slice(0, 1000)] as [string, string])
      .slice(0, 80),
    images: unique(out.images ?? []).slice(0, 15),
    pricePaise: out.pricePaise ?? null,
    mrpPaise: out.mrpPaise ?? null,
    currency: out.currency ? out.currency.toUpperCase().slice(0, 8) : null,
    inStock: out.inStock ?? null,
    sizes: (out.sizes ?? []).slice(0, 40),
    hints: (out.hints ?? []).map((h) => h.slice(0, 120)).slice(0, 10),
    variants,
    deliveryText: oneLine(raw.delivery ?? '').slice(0, 300) || null,
  };
  if (!product.title || (!product.images.length && product.pricePaise === null)) return null;
  const parsed = sourcedProductSchema.safeParse(product);
  return parsed.success ? parsed.data : null;
}
