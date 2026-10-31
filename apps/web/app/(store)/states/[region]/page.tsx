import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { inStatePage, PAGE, parseBrowseQuery, toBrowseFilter } from '@/features/catalog/browse-query';
import { BrowseView } from '@/features/catalog/browse-view';
import { CuratedCard } from '@/features/catalog/curated-card';
import { browseStateCached, getHomeCached, getRegionHeadCached, getStorePolicyCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { StorePhoto } from '@/features/catalog/store-photo';
import { RegionAlbum } from '@/features/regions/region-album';
import { ComingSoon, RegionTypeTabs } from '@/features/regions/region-type-tabs';
import { scriptFontClass } from '@/features/regions/script-fonts';
import { mediaUrl } from '@/lib/site';

import type { Metadata } from 'next';

type Params = Promise<{ region: string }>;

/** A state page's reads, all cached: its head, the policy and its first type's first 24 cards (D-157). */
async function regionReads(slug: string) {
  const page = await getRegionHeadCached(slug);
  if (!page) return null;
  const counts = page.type_counts;
  // Clothing, or the first type the state has
  const firstType = PRODUCT_TYPES.find((t) => counts[t] > 0) ?? 'clothing';
  const query = inStatePage(parseBrowseQuery({}), slug);
  const [policy, initial] = await Promise.all([
    getStorePolicyCached(),
    page.region.is_live && counts[firstType] > 0
      ? browseStateCached({ ...toBrowseFilter(firstType, query, 0, PAGE), regionSlug: slug })
      : null,
  ]);
  return { page, firstType, query, policy, initial };
}

/** The 36 region pages are built ahead of time and refreshed from the cache (PR-1). */
export async function generateStaticParams(): Promise<{ region: string }[]> {
  // A page that fails to build fails the whole deploy, with no way to skip it: a busy database did so twice on
  // 2026-10-31 (statement timeouts while the sourcing runner was adding listings). So each page's reads are made here
  // first, four states at a time, which fills the cache its build then reads; a state whose reads fail is left out and
  // built on its first visit instead, as 7-day's categories are.
  try {
    const { regions } = await getHomeCached();
    const built: { region: string }[] = [];
    for (let i = 0; i < regions.length; i += 4) {
      const group = regions.slice(i, i + 4);
      const read = await Promise.all(group.map((r) => regionReads(r.slug).then(() => true, () => false)));
      built.push(...group.filter((_, j) => read[j]).map((r) => ({ region: r.slug })));
    }
    return built;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = await getRegionHeadCached((await params).region);
  return page ? { title: page.region.name } : {};
}

export default async function RegionPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const reads = await regionReads((await params).region);
  if (!reads) notFound();
  const { page, firstType, query, policy, initial } = reads;
  const { region, album, most_wanted: mostWanted, curated, type_counts: counts } = page;
  const slugOf = (type: ProductType): string => PRODUCT_TYPE_PATH[type].slice(1);
  const tabs = PRODUCT_TYPES.map((t) => ({ slug: slugOf(t), label: PRODUCT_TYPE_LABEL[t], count: counts[t] }));
  // D-157: the first type's inventory as See all draws it, the state fixed: its first 24 cards and filter counts, one
  // cached store_browse() read refreshed with the state (a sale shows Sold out here at once); the other types are read
  // when opened (region-type-tabs.tsx), so building the 36 state pages reads one inventory each
  const quickDays = policy.quick_delivery_on ? policy.quick_delivery_days_max : null;
  const firstView =
    initial && initial.total > 0 ? (
      <BrowseView productType={firstType} title={PRODUCT_TYPE_LABEL[firstType]} initialQuery={query} initial={initial} quickDays={quickDays} />
    ) : (
      <ComingSoon type={firstType} regionName={region.name} />
    );

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
          <ProductRow
            id="most-wanted"
            title="Most wanted"
            sub={`Most ordered from ${region.name} in the last 30 days.`}
            products={mostWanted}
          />
          <CuratedCard id="curated" products={curated} regionName={region.name} />
          <RegionTypeTabs
            tabs={tabs}
            first={slugOf(firstType)}
            region={region.slug}
            regionName={region.name}
            firstView={firstView}
            quickDays={quickDays}
          />
        </>
      )}
    </div>
  );
}
