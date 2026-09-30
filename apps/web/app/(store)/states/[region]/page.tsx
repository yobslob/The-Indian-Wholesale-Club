import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getHomeCached, getRegionPageCached } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
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

function Section({
  id,
  title,
  sub,
  products,
  empty,
}: {
  id: string;
  title: string;
  sub?: string;
  products: RegionProductCard[];
  empty: string;
}): React.JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 py-[clamp(28px,3.4vw,56px)]">
      <div className="mb-[clamp(18px,2vw,28px)]">
        <h2 id={`${id}-h`} className={heading}>
          {title}
        </h2>
        {sub ? <p className="text-ink-muted mt-1.5 text-sm">{sub}</p> : null}
      </div>
      {products.length === 0 ? (
        <p className="bg-surface font-display rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">{empty}</p>
      ) : (
        <ProductGrid>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ProductGrid>
      )}
    </section>
  );
}

/**
 * The core page (storefront.md §The region page, design.md §Direction). One cached store_region_page()
 * call. Target sections still waiting: Most wanted, Curated for you, Leaving soon (Q-22) and the photo
 * album (region photos, C2); until then every piece is listed under Clothing / Spices.
 */
export default async function RegionPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const page = await getRegionPageCached((await params).region);
  if (!page) notFound();
  const { region, products } = page;
  const clothing = products.filter((p) => p.product_type === 'clothing');
  const spices = products.filter((p) => p.product_type === 'spice');
  const newest = products.slice(0, 4); // store_region_page returns newest first

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
            <Image src={mediaUrl(region.hero_image_path)} alt="" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          ) : null}
        </div>
      </section>

      {!region.is_live ? (
        <p className="bg-surface font-display mb-8 rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
          {region.name} is coming soon. We are adding its clothing and spices.
        </p>
      ) : (
        <>
          <nav aria-label="Sections" className="bg-canvas/90 sticky top-[68px] z-10 -mx-[var(--gut)] flex gap-2.5 px-[var(--gut)] py-3 backdrop-blur">
            <a href="#new-arrivals" className={pill}>
              New arrivals
            </a>
            <a href="#clothing" className={pill}>
              Clothing <span className="text-ink-muted">{clothing.length}</span>
            </a>
            <a href="#spices" className={pill}>
              Spices <span className="text-ink-muted">{spices.length}</span>
            </a>
          </nav>
          <Section id="new-arrivals" title="New arrivals" sub={`Newest pieces from ${region.name}.`} products={newest} empty="New pieces are on their way." />
          <Section id="clothing" title="Clothing" products={clothing} empty={`Clothing from ${region.name} is coming soon.`} />
          <Section id="spices" title="Spices" products={spices} empty={`Spices from ${region.name} are coming soon.`} />
        </>
      )}
    </div>
  );
}
