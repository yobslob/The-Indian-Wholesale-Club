import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { CuratedCard } from '@/features/catalog/curated-card';
import { getHomeCached, getRegionPageCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { RowScroller } from '@/features/catalog/row-scroller';
import { StorePhoto } from '@/features/catalog/store-photo';
import { RegionAlbum } from '@/features/regions/region-album';
import { scriptFontClass } from '@/features/regions/script-fonts';
import { RegionTypeTabs } from '@/features/regions/region-type-tabs';
import { mediaUrl } from '@/lib/site';

import type { RegionPage, RegionProductCard } from '@repo/db/store';
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

const heading = 'font-heading text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]';
const chip =
  'font-ui border-line bg-paper hover:border-ink inline-flex min-h-11 items-center gap-2 rounded-pill border px-5 text-sm font-medium transition-colors duration-300';
const pieces = (n: number): string => `${n.toLocaleString('en-US')} ${n === 1 ? 'piece' : 'pieces'}`;

const ROW = 12;

/** A type's categories, the biggest first, each with its first 12 cards and its real total (category_counts). */
function byCategory(
  page: RegionPage,
  type: ProductType,
): { slug: string; name: string; count: number; items: RegionProductCard[] }[] {
  return page.category_counts
    .filter((c) => c.product_type === type)
    .map((c) => ({ ...c, items: page.products.filter((p) => p.category_slug === c.slug && p.product_type === type) }))
    .filter((c) => c.items.length > 0);
}

export default async function RegionPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const page = await getRegionPageCached((await params).region);
  if (!page) notFound();
  const { region, album, products, most_wanted: mostWanted, curated, leaving_soon: leavingSoon } = page;
  const browse = (type: ProductType, category?: string): string =>
    `${PRODUCT_TYPE_PATH[type]}?state=${region.slug}${category ? `&category=${category}` : ''}`;
  const slugOf = (type: ProductType): string => PRODUCT_TYPE_PATH[type].slice(1);
  const countOf = (type: ProductType): number =>
    page.category_counts.filter((c) => c.product_type === type).reduce((n, c) => n + c.count, 0);
  const tabs = PRODUCT_TYPES.map((t) => ({ slug: slugOf(t), label: PRODUCT_TYPE_LABEL[t], count: countOf(t) }));

  /**
   * One type's rows, as Home and the 7-day store draw theirs (a heading, its count, See all): the state's newest, Most
   * wanted, Picked for you, Leaving soon, then a row per category, the biggest first. Clothing keeps the ids links
   * and tests use (#new-arrivals, #c-kurtas).
   */
  const panel = (type: ProductType): React.ReactNode => {
    const label = PRODUCT_TYPE_LABEL[type];
    const own = (p: RegionProductCard): boolean => p.product_type === type;
    const id = (name: string): string => (type === 'clothing' ? name : `${name}-${slugOf(type)}`);
    const categories = byCategory(page, type);
    // D-122: the first row is the state's own pieces, newest first; all-India pieces fill the rows below
    const newest = products.filter((p) => own(p) && p.region_slug === region.slug).slice(0, ROW);
    if (countOf(type) === 0)
      return (
        <section className="py-[clamp(24px,3vw,48px)]">
          <h2 className={heading}>{label}</h2>
          <p className="bg-surface font-body mt-[clamp(16px,1.8vw,24px)] rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
            {type === 'clothing' ? 'New pieces are on their way.' : `${label} from ${region.name} ${type === 'food' ? 'is' : 'are'} coming soon.`}
          </p>
        </section>
      );
    return (
      <>
        {categories.length > 1 ? (
          <nav aria-label={`${label} by category`} className="pt-[clamp(8px,1vw,16px)]">
            <RowScroller label={`${label} by category`} pills>
              {categories.map((c) => (
                <li key={c.slug} className="shrink-0">
                  <a href={`#c-${c.slug}`} className={chip}>
                    {c.name} <span className="text-ink-muted">{c.count.toLocaleString('en-US')}</span>
                  </a>
                </li>
              ))}
            </RowScroller>
          </nav>
        ) : null}
        <ProductRow
          id={id('new-arrivals')}
          title="New arrivals"
          sub={`Newest ${type === 'home' ? 'home & gifts' : label.toLowerCase()} from ${region.name}.`}
          products={newest}
          href={browse(type)}
        />
        <ProductRow
          id={id('most-wanted')}
          title="Most wanted"
          sub={`Most ordered from ${region.name} in the last 30 days.`}
          products={mostWanted.filter(own)}
        />
        <CuratedCard id={id('curated')} products={curated.filter(own)} regionName={region.name} />
        <ProductRow
          id={id('leaving-soon')}
          title="Leaving soon"
          sub="Only a few pieces left of these."
          products={leavingSoon.filter(own)}
          badge={(p) => `${p.available} left`}
        />
        {categories.map((c) => (
          <ProductRow
            key={c.slug}
            id={`c-${c.slug}`}
            title={c.name}
            sub={pieces(c.count)}
            products={c.items.slice(0, ROW)}
            href={browse(type, c.slug)}
          />
        ))}
      </>
    );
  };

  return (
    <div
      style={region.accent_color ? ({ '--region-accent': region.accent_color } as React.CSSProperties) : undefined}
    >
      <section className="grid gap-x-[var(--gap)] gap-y-8 pb-[clamp(24px,4vw,64px)] md:grid-cols-2">
        <div className="font-body md:pt-[clamp(16px,5vw,80px)]">
          <p className="font-ui text-ink-muted mb-7 text-[13px] font-medium">
            <Link href="/states" className="underline">
              All of India
            </Link>
            &nbsp;/&nbsp; {region.name}
          </p>
          {region.greeting_native ? (
            <p
              className={`write-in text-region m-0 text-[clamp(56px,8vw,128px)] font-light leading-[1.15] ${scriptFontClass(region.greeting_script)}`}
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
          <h1 className="font-display text-ink m-0 text-[clamp(54px,7.4vw,112px)] font-normal leading-[0.95]">{region.name}</h1>
          {region.tagline ? <p className="mt-7 max-w-[44ch] text-lg">{region.tagline}</p> : null}
          {region.story ? <p className="text-ink-muted font-body mt-4 max-w-[60ch] whitespace-pre-line">{region.story}</p> : null}
        </div>
        <div className="bg-region relative aspect-[5/6] overflow-hidden rounded-lg">
          {region.hero_image_path ? (
            <div data-speed="0.06" className="absolute -inset-y-[6%] inset-x-0">
              <StorePhoto src={mediaUrl(region.hero_image_path)} alt="" priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
          ) : null}
        </div>
      </section>

      {!region.is_live ? (
        <p className="bg-surface font-body mb-8 rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
          {region.name} is coming soon. We are adding its clothing, food and gifts.
        </p>
      ) : (
        <>
          <RegionAlbum photos={album} regionName={region.name} />
          <RegionTypeTabs
            tabs={tabs}
            first={(tabs.find((t) => t.count > 0) ?? tabs[0])?.slug ?? 'clothing'}
            panels={Object.fromEntries(PRODUCT_TYPES.map((t) => [slugOf(t), panel(t)]))}
          />
        </>
      )}
    </div>
  );
}
