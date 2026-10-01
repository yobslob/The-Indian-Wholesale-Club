import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CuratedCard } from '@/features/catalog/curated-card';
import { getHomeCached, getRegionPageCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { RegionAlbum } from '@/features/regions/region-album';
import { scriptFontClass } from '@/features/regions/script-fonts';
import { mediaUrl } from '@/lib/site';

import type { RegionProductCard } from '@repo/db/store';
import type { Metadata } from 'next';

type Params = Promise<{ region: string }>;

/** The 36 region pages are built ahead of time and refreshed from the cache (PR-1). */
export async function generateStaticParams(): Promise<{ region: string }[]> {
  const { regions } = await getHomeCached();
  return regions.map((r) => ({ region: r.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = await getRegionPageCached((await params).region);
  return page ? { title: page.region.name } : {};
}

const heading = 'font-hero text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]';
const pill =
  'font-ui border-line bg-paper hover:border-ink inline-flex min-h-11 items-center gap-2 rounded-pill border px-5 text-sm font-medium';

/** Clothing grouped by category, the biggest first: one row each (D-062). */
function byCategory(products: RegionProductCard[]): { slug: string; name: string; items: RegionProductCard[] }[] {
  const groups = new Map<string, { slug: string; name: string; items: RegionProductCard[] }>();
  for (const p of products) {
    const group = groups.get(p.category_slug) ?? { slug: p.category_slug, name: p.category_name, items: [] };
    group.items.push(p);
    groups.set(p.category_slug, group);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'en'));
}

const ROW = 12;

/**
 * The core page (storefront.md §The region page, design.md §Direction). One cached store_region_page()
 * call. Every list is a row that scrolls sideways with See all where there is more (D-062): New arrivals, Most wanted
 * (D-058), the album (D-051, once it has three photos), Curated for you and Leaving soon (D-056), then one row per
 * clothing category, then Spices.
 */
export default async function RegionPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const page = await getRegionPageCached((await params).region);
  if (!page) notFound();
  const { region, album, products, most_wanted: mostWanted, curated, leaving_soon: leavingSoon } = page;
  const clothing = products.filter((p) => p.product_type === 'clothing');
  const spices = products.filter((p) => p.product_type === 'spice');
  const categories = byCategory(clothing);
  const newest = products.slice(0, ROW); // store_region_page returns newest first
  const browse = (type: 'clothing' | 'spices', category?: string): string =>
    `/${type}?state=${region.slug}${category ? `&category=${category}` : ''}`;

  return (
    <div
      style={region.accent_color ? ({ '--region-accent': region.accent_color } as React.CSSProperties) : undefined}
    >
      <section className="grid gap-x-[var(--gap)] gap-y-8 pb-[clamp(24px,4vw,64px)] md:grid-cols-2">
        <div className="font-hero md:pt-[clamp(16px,5vw,80px)]">
          <p className="font-ui text-ink-muted mb-7 text-[13px] font-medium">
            <Link href="/states" className="underline">
              All of India
            </Link>
            &nbsp;/&nbsp; {region.name}
          </p>
          {region.greeting_native ? (
            <p
              className={`text-region m-0 text-[clamp(56px,8vw,128px)] font-light leading-[1.15] ${scriptFontClass(region.greeting_script)}`}
              lang={region.greeting_script ? `und-${region.greeting_script}` : undefined}
            >
              {region.greeting_native}
            </p>
          ) : null}
          {region.greeting_latin || region.greeting_meaning ? (
            <p className="text-ink-muted mb-8 mt-1.5 text-[15px]">
              {region.greeting_latin}
              {region.greeting_latin && region.greeting_meaning ? ' · ' : null}
              {region.greeting_meaning ? <span className="text-ink">{region.greeting_meaning}</span> : null}
            </p>
          ) : null}
          <h1 className="m-0 text-[clamp(64px,9.5vw,164px)] font-medium leading-[0.92] tracking-[-0.045em]">{region.name}</h1>
          {region.tagline ? <p className="mt-7 max-w-[44ch] text-lg">{region.tagline}</p> : null}
          {region.story ? <p className="text-ink-muted font-body mt-4 max-w-[60ch] whitespace-pre-line">{region.story}</p> : null}
        </div>
        <div className="bg-region relative aspect-[5/6] overflow-hidden rounded-lg">
          {region.hero_image_path ? (
            <div data-speed="0.06" className="absolute -inset-y-[6%] inset-x-0">
              <Image src={mediaUrl(region.hero_image_path)} alt="" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
          ) : null}
        </div>
      </section>

      {!region.is_live ? (
        <p className="bg-surface font-display mb-8 rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
          {region.name} is coming soon. We are adding its clothing and spices.
        </p>
      ) : (
        <>
          <nav
            aria-label="Sections"
            className="no-scrollbar bg-canvas sticky top-[68px] z-10 -mx-[var(--gut)] flex gap-2.5 overflow-x-auto px-[var(--gut)] py-3"
          >
            <a href="#new-arrivals" className={`${pill} shrink-0`}>
              New arrivals
            </a>
            {categories.map((c) => (
              <a key={c.slug} href={`#c-${c.slug}`} className={`${pill} shrink-0`}>
                {c.name} <span className="text-ink-muted">{c.items.length}</span>
              </a>
            ))}
            <a href="#spices" className={`${pill} shrink-0`}>
              Spices <span className="text-ink-muted">{spices.length}</span>
            </a>
          </nav>
          {newest.length > 0 ? (
            <ProductRow
              id="new-arrivals"
              title="New arrivals"
              sub={`Newest pieces from ${region.name}.`}
              products={newest}
              href={browse('clothing')}
            />
          ) : (
            <section id="new-arrivals" className="py-[clamp(24px,3vw,48px)]">
              <p className="bg-surface font-display rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
                New pieces are on their way.
              </p>
            </section>
          )}
          <ProductRow
            id="most-wanted"
            title="Most wanted"
            sub={`Most ordered from ${region.name} in the last 30 days.`}
            products={mostWanted}
          />
          <RegionAlbum photos={album} regionName={region.name} />
          <CuratedCard id="curated" products={curated} regionName={region.name} />
          <ProductRow
            id="leaving-soon"
            title="Leaving soon"
            sub="Only a few pieces left of these."
            products={leavingSoon}
            badge={(p) => `${p.available} left`}
          />
          {categories.map((c) => (
            <ProductRow
              key={c.slug}
              id={`c-${c.slug}`}
              title={c.name}
              products={c.items.slice(0, ROW)}
              href={browse('clothing', c.slug)}
            />
          ))}
          {spices.length > 0 ? (
            <ProductRow id="spices" title="Spices" products={spices.slice(0, ROW)} href={browse('spices')} />
          ) : (
            <section id="spices" aria-labelledby="spices-h" className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
              <h2 id="spices-h" className={heading}>
                Spices
              </h2>
              <p className="bg-surface font-display mt-[clamp(16px,1.8vw,24px)] rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
                Spices from {region.name} are coming soon.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
