import { attributesSchemaFor } from '../../domain/attributes';
import { variantLabel, type VariantOptions } from '../../domain/listing';
import { guessDetails } from '../guess';
import { liquidReason } from '../liquid';
import { shorten } from '../text';
import { cleanTitle } from '../title';
import { cleanOptions, packGrams } from '../variants';
import { bestWeight, readWeights } from '../weight';

import { inBand, offerDeliveryDays } from './cluster';
import { packedFoodVariants } from './food-weights';
import { homeVariants } from './home-weights';

import type { SourcedProduct, SourcedVariant } from '../capture';
import type { ListingVariantPayload, Offer, SourcingShop, SourcingTarget } from './types';

/**
 * A read product page as the listing the runner adds (worker_sourcing_add, D-118): its items with their own prices,
 * the same product on other shops as backups, the words with every trace of the shop removed (D-003), the details
 * customers must see when the page has them, and the photos to copy. Pure, no I/O.
 */

const SHOP_WORDS =
  /legal disclaimer|our (app|website|site)|important information|amazon|flipkart|myntra|blinkit|grofers|zepto|bigbasket|big basket|instamart|swiggy|oyela|offduty|nishorama|jiomart|meesho|ajio|nykaa|snapdeal|\bbuy\b|online|cash on delivery|free (shipping|delivery)|deliver(y|ed)|doorstep|replacement|return(s|able)?\b|refund|seller|warranty|genuine products?|best price|lowest price|\bmrp\b|discount|\boffer\b|coupon|in stock|add to cart|https?:\/\/|www\./i;

/** Text without the sentences that speak of the shop, delivery, returns or prices (D-003; IWC's own terms differ). */
export function sanitizeText(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '')
    .split(/\n+/)
    .map((para) =>
      para
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !SHOP_WORDS.test(sentence))
        .join(' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}

/** A name without the pack size, the shop's tags or a trailing "| …". */
export function listingName(title: string): string {
  const clean = title
    .replace(/^\s*amazon brand\s*[-–:]\s*/i, '')
    .replace(/\s*[|]\s.*$/, '')
    .replace(/\(\s*(pack of \d+|\d+(\.\d+)?\s*(g|gm|gms|kg|ml|l|pcs)[^)]*)\)/gi, ' ')
    .replace(
      /\s+[-–,]\s*(pack of )?\d+(\.\d+)?\s*(g|gm|gms|grams?|kg|kgs|ml|l|litres?|pcs|pieces)\b.*$/i,
      '',
    )
    .replace(/[,-]?\s*\b(pack of \d+|\d+(\.\d+)?\s*(g|gm|gms|grams|kg|ml|l|pcs))\b\s*$/i, '')
    .replace(/\b(on|at|from)\s+(amazon|flipkart|myntra|blinkit|zepto|bigbasket)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return shorten(clean || title, 120);
}

/** The shop's id for a page's single item: the ASIN, the pid, the product id, else the address itself. */
export function itemKeyOf(url: string): string {
  try {
    const u = new URL(url);
    return (
      u.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] ??
      u.searchParams.get('pid') ??
      u.pathname.match(/\/(?:prid|pvid|pd|item)\/([A-Za-z0-9-]+)/)?.[1] ??
      `${u.hostname.replace(/^www\./, '')}${u.pathname}`.slice(0, 200)
    );
  } catch {
    return url.slice(0, 200);
  }
}

const formatPack = (grams: number): string =>
  grams >= 1000 && grams % 100 === 0 ? `${grams / 1000} kg` : `${grams} g`;

function attributesFor(product: SourcedProduct, type: SourcingTarget['product_type']) {
  const d = guessDetails(product);
  const allergenSpec = product.specs.find(([k]) => /^allergen/i.test(k))?.[1] ?? '';
  const raw =
    type === 'clothing'
      ? { fibre_content: d.fibre.trim(), care: d.care.trim() }
      : type === 'home'
        ? { material: d.material.trim() }
        : {
            ingredients: d.ingredients.trim(),
            // only what the page declares: an empty list would tell customers "none declared"
            allergens: allergenSpec
              ? allergenSpec
                  .split(/[,;]/)
                  .map((a) => a.trim())
                  .filter((a) => a && !/^(none|nil|na)$/i.test(a))
              : undefined,
            shelf_life_days: d.shelfLifeDays ?? undefined,
          };
  const parsed = attributesSchemaFor(type).safeParse(raw);
  if (parsed.success)
    return { attributes: parsed.data as Record<string, unknown>, complete: true, missing: [] };
  // what the page had, for the admin to finish (the store shows details only once they are complete)
  const found = Object.fromEntries(
    Object.entries(raw).filter(
      ([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length),
    ),
  );
  // D-137: what is missing, named in the run log ("material", "ingredients")
  const missing = [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? 'details')))];
  return { attributes: found, complete: false, missing };
}

export interface ListingDraft {
  listing: {
    site: string;
    shop_label: string;
    page_url: string;
    name: string;
    summary: string;
    description: string;
    attributes: Record<string, unknown>;
    weight_g: number | null;
    variants: ListingVariantPayload[];
    backups: (Omit<ListingVariantPayload, 'label' | 'options' | 'weight_g'> & {
      variant: number;
      site: string;
      page_url: string;
    })[];
  };
  photos: { url: string; itemKey: string | null; alt: string }[];
  /** D-135: why it is a liquid (archived and shown as coming soon), or null. */
  liquid: string | null;
  /** Every detail customers must see was found: it may go live by itself (when the founder turned that on). */
  complete: boolean;
  /** D-137: what keeps it from complete ("material", "photos"), for the run log. */
  missing: string[];
}

export function buildListing(input: {
  product: SourcedProduct;
  target: SourcingTarget;
  shop: SourcingShop;
  /** The page's own delivery promise in days, if it has one. */
  pageDays: number | null;
  /** The same shop's family items found in its search (Blinkit's pack sizes), when the page lists none. */
  family: Offer[];
  /** The same product on other shops. */
  others: Offer[];
  shops: SourcingShop[];
  maxDays: number;
  now: Date;
  /** The page an item was read on, when not the product's own (Myntra's other colours). */
  pageOf?: Map<string, string>;
}): ListingDraft | { skip: string } {
  const { product, target, shop } = input;
  const days = input.pageDays ?? shop.delivery_days;
  if (days === null) return { skip: 'the page promises no delivery date' };
  if (days > input.maxDays) return { skip: `delivery takes ${days} days` };

  let items: SourcedVariant[] = product.variants.filter((v) => v.pricePaise);
  if (!items.length && input.family.length > 1) {
    items = input.family.map((o) => ({
      key: o.key,
      url: o.url,
      label: o.pack ?? o.title,
      options: cleanOptions({ pack: o.pack ?? '' }),
      pricePaise: o.pricePaise,
      mrpPaise: o.mrpPaise,
      inStock: o.inStock,
      weightG: packGrams(o.pack ?? ''),
      image: o.image,
    }));
  }
  if (!items.length && product.pricePaise) {
    const grams = target.product_type === 'clothing' ? null : packGrams(product.title);
    const options: VariantOptions = grams ? { pack: formatPack(grams) } : {};
    items = [
      {
        key: itemKeyOf(product.url),
        url: product.url,
        label: variantLabel(options),
        options,
        pricePaise: product.pricePaise,
        mrpPaise: product.mrpPaise,
        inStock: product.inStock,
        weightG: grams,
        image: null,
      },
    ];
  }
  items = items.filter((v) => v.pricePaise).slice(0, 60);
  if (!items.length) return { skip: 'no price on the page' };
  // D-121: a colour or size dearer or cheaper than the target's band is left out; none inside, no listing
  items = items.filter((v) => inBand(target, v.pricePaise));
  if (!items.length) return { skip: 'price outside the band' };
  if (!items.some((v) => v.inStock !== false)) return { skip: 'sold out' };
  // D-004: the store says "Made in India"; a page that names another country of origin is not listed
  const origin =
    product.specs.find(([k]) => /country of origin|origin country/i.test(k))?.[1] ?? '';
  if (origin && !/india|bharat/i.test(origin))
    return { skip: `made in ${origin.slice(0, 40)}, not India` };

  const labels = new Set<string>();
  // D-129: an item's own pack is its weight; otherwise the page's stated weight, when it can only be this item's
  // (one item, or sizes and colours of one piece). Clothing never takes a weight from its title.
  const read = bestWeight(readWeights(product));
  const pageWeight =
    read && !(target.product_type === 'clothing' && read.kind === 'title') ? read : null;
  const sharesPageWeight = items.length === 1 || items.every((v) => !v.weightG);
  const variants: ListingVariantPayload[] = items.map((v, i) => {
    let label = v.label;
    if (labels.has(label.toLowerCase())) label = `${label} (${i + 1})`.slice(0, 80);
    labels.add(label.toLowerCase());
    return {
      item_key: v.key,
      item_url: v.url,
      ...(input.pageOf?.get(v.key) ? { page_url: input.pageOf.get(v.key) } : {}),
      label,
      options: v.options,
      price_paise: v.pricePaise!,
      mrp_paise: v.mrpPaise,
      in_stock: v.inStock !== false,
      delivery_days: input.pageDays,
      ...(v.weightG
        ? {
            weight_g: v.weightG,
            weight_source: 'shop' as const,
            weight_note: `Pack: ${v.label}`.slice(0, 200),
          }
        : pageWeight && sharesPageWeight
          ? {
              weight_g: pageWeight.grams,
              weight_source: 'shop' as const,
              weight_note: pageWeight.note,
            }
          : { weight_g: null }),
    };
  });

  const shopOf = new Map(input.shops.map((s) => [s.site, s]));
  const backups = input.others.flatMap((o) => {
    const oDays = offerDeliveryDays(o, shopOf.get(o.site), input.now);
    if (oDays === null || oDays > input.maxDays || !o.pricePaise) return [];
    const grams = packGrams(o.pack ?? o.title);
    const at =
      variants.length === 1 ? 0 : variants.findIndex((v) => grams !== null && v.weight_g === grams);
    if (at < 0) return [];
    return [
      {
        variant: at + 1,
        site: o.site,
        page_url: o.url,
        item_url: o.url,
        item_key: o.key,
        price_paise: o.pricePaise,
        mrp_paise: o.mrpPaise,
        in_stock: o.inStock !== false,
        // the result's own promise; without one the shop's usual days apply (in the database)
        delivery_days: o.deliveryText ? oDays : null,
      },
    ];
  });

  const bullets = product.bullets.map(sanitizeText).filter(Boolean);
  const description = sanitizeText(
    [bullets.map((b) => `• ${b}`).join('\n'), product.description].join('\n\n'),
  );
  // D-140 (L1): IWC's name, not the shop's title: no brand or shop, about six words (food keeps its brand, D-139)
  const name = listingName(cleanTitle(product.title, { brand: product.brand, productType: target.product_type }));
  const { attributes, complete, missing } = attributesFor(product, target.product_type);
  const seenPhotos = new Set(product.images.slice(0, 8));
  const photos = [
    ...product.images
      .slice(0, 8)
      .map((url) => ({ url, itemKey: null as string | null, alt: name })),
    ...items
      .filter((v) => v.image && !seenPhotos.has(v.image) && !!seenPhotos.add(v.image))
      .slice(0, 12)
      .map((v) => ({ url: v.image!, itemKey: v.key as string | null, alt: `${name}, ${v.label}` })),
  ];
  return {
    listing: {
      site: product.site,
      shop_label: shop.label,
      page_url: product.url,
      name,
      summary: shorten(bullets[0] ?? description.split(/(?<=[.!?])\s/)[0] ?? '', 300),
      description: description.slice(0, 4000),
      attributes,
      weight_g: pageWeight?.grams ?? null,
      // D-133: food on its net quantity plus its pack; D-134: home on its own page's weight, checked and packed
      // (both read while the page's spec rows are at hand)
      variants:
        target.product_type === 'food'
          ? packedFoodVariants(variants, {
              name: product.title,
              description,
              category: target.category,
              specs: product.specs,
            })
          : target.product_type === 'home'
            ? homeVariants(variants, product)
            : variants,
      backups,
    },
    photos,
    complete: complete && photos.length > 0,
    missing: [...missing, ...(photos.length ? [] : ['photos'])],
    liquid: liquidReason({
      type: target.product_type,
      name: product.title,
      labels: items.map((v) => v.label),
      specs: product.specs,
    }),
  };
}
