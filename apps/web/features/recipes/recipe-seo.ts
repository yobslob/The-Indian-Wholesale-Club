import { mediaUrl, SITE_NAME } from '@/lib/site';

import type { RecipePage } from '@repo/db/store';
import type { Metadata } from 'next';

/**
 * D-203, plan §5.4: a recipe page's metadata and schema.org Recipe JSON-LD, from what the page shows: name, line, photo,
 * time, servings, every ingredient (from IWC and from the local store) and the steps. No listing, shop or price (D-003).
 */

const sharePhoto = (path: string | null): string | null => (path ? mediaUrl(path) : null);

export function recipeMetadata(r: RecipePage): Metadata {
  const title = `${r.name} recipe`;
  const path = `/recipes/${r.slug}`;
  const photo = sharePhoto(r.photo_path);
  const description = r.blurb || undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'article', siteName: SITE_NAME, url: path, title, description, images: photo ? [{ url: photo, alt: r.name }] : undefined },
    twitter: { card: photo ? 'summary_large_image' : 'summary', title, description, images: photo ? [photo] : undefined },
  };
}

/** ISO 8601 minutes: 75 → "PT1H15M". */
const duration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ''}${m || !h ? `${m}M` : ''}`;
};

export function recipeJsonLdText(r: RecipePage, base: string): string {
  const photo = sharePhoto(r.photo_path);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.name,
    description: r.blurb || undefined,
    image: photo ? [photo.startsWith('http') ? photo : `${base}${photo}`] : undefined,
    totalTime: duration(r.minutes),
    recipeYield: `${r.serves} servings`,
    recipeCategory: r.kind,
    recipeCuisine: 'Indian',
    recipeIngredient: r.lines.map((l) => [l.amount, l.label].filter(Boolean).join(' ')),
    recipeInstructions: r.steps.map((s) => ({ '@type': 'HowToStep', text: s.text })),
    datePublished: r.published_at ?? undefined,
  };
  // "<" escaped so the text can't close the script element
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
