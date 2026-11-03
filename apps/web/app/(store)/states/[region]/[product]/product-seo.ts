import {
  displayTitle,
  hasCopies,
  optionPriceLabel,
  photoJpegUrl,
  PRODUCT_TYPE_LABEL,
  PRODUCT_TYPE_PATH,
  productPath,
  usableSummary,
} from '@repo/shared/domain';

import { siteUrl } from '@/lib/env';
import { mediaUrl, SITE_NAME } from '@/lib/site';

import type { ProductPage } from '@repo/db/store';
import type { Metadata } from 'next';

/**
 * E-2a/E-2b: a product page's metadata and JSON-LD, from what the page itself shows: its title (displayTitle), summary,
 * main photo, option prices and stock, its state or type. Nothing about where a piece is sourced, no shop and no brand
 * (D-003); the origin only as the page says it, "Made in India" unless the piece is marked imported (D-004, D-171).
 */

/** The main photo as the page's JPEG copy (link previews can't read AVIF), on the site's own address. */
export function sharePhoto(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const url = mediaUrl(storagePath);
  return hasCopies(url) ? photoJpegUrl(url, 1200) : url;
}

/** Integer cents as a decimal string, without floating point (CLAUDE.md rule 5). */
export const centsToDecimal = (cents: number): string =>
  `${Math.floor(cents / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;

export function productMetadata(page: ProductPage): Metadata {
  const { product, variants, media } = page;
  const title = displayTitle(product.name);
  const summary = usableSummary(product.summary, product.description) ?? undefined;
  const path = productPath(product.region_slug, product.slug);
  const photo = sharePhoto(product.primary_image_path ?? media[0]?.storage_path);
  const price = product.coming_soon ? 'Coming soon' : optionPriceLabel(variants);
  const shareText = [price, summary].filter(Boolean).join(' · ') || undefined;
  const images = photo ? [{ url: photo, alt: title }] : undefined;
  return {
    title,
    description: summary,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_US', url: path, title, description: shareText, images },
    twitter: { card: photo ? 'summary_large_image' : 'summary', title, description: shareText, images: photo ? [photo] : undefined },
  };
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

function offers(page: ProductPage, url: string): Json | undefined {
  const { product, variants } = page;
  if (product.coming_soon || variants.length === 0) return undefined;
  const prices = variants.map((v) => v.price_cents);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const availability = variants.some((v) => v.available > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
  return low === high
    ? { '@type': 'Offer', url, priceCurrency: 'USD', price: centsToDecimal(low), availability, itemCondition: 'https://schema.org/NewCondition' }
    : {
        '@type': 'AggregateOffer',
        url,
        priceCurrency: 'USD',
        lowPrice: centsToDecimal(low),
        highPrice: centsToDecimal(high),
        offerCount: variants.length,
        availability,
      };
}

/** schema.org Product (with its offers) and BreadcrumbList, as absolute URLs on the domain. */
export function productJsonLd(page: ProductPage, base: string = siteUrl()): Json {
  const { product, media } = page;
  const url = `${base}${productPath(product.region_slug, product.slug)}`;
  const title = displayTitle(product.name);
  const photo = sharePhoto(product.primary_image_path ?? media[0]?.storage_path);
  const parent = product.region_slug
    ? { name: product.region_name ?? product.region_slug, item: `${base}/states/${product.region_slug}` }
    : { name: PRODUCT_TYPE_LABEL[product.product_type], item: `${base}${PRODUCT_TYPE_PATH[product.product_type]}` };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: title,
        url,
        description: usableSummary(product.summary, product.description) ?? undefined,
        image: photo ? [`${base}${photo}`] : undefined,
        category: product.category_name,
        countryOfOrigin: product.made_in_india === false ? undefined : { '@type': 'Country', name: 'India' },
        offers: offers(page, url),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${base}/` },
          { '@type': 'ListItem', position: 2, ...parent },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
    ],
  };
}

/** The JSON-LD element's text; `<` is escaped so no product text can close the script. */
export function productJsonLdText(page: ProductPage, base?: string): string {
  return JSON.stringify(productJsonLd(page, base)).replace(/</g, '\\u003c');
}
