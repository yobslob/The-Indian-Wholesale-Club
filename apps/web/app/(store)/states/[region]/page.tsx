import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { inStatePage, PAGE, parseBrowseQuery, toBrowseFilter } from '@/features/catalog/browse-query';
import { BrowseView } from '@/features/catalog/browse-view';
import { CuratedCard } from '@/features/catalog/curated-card';
import { browseCached, getHomeCached, getRegionPageCached, getStorePolicyCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { StorePhoto } from '@/features/catalog/store-photo';
import { RegionAlbum } from '@/features/regions/region-album';
import { RegionTypeTabs } from '@/features/regions/region-type-tabs';
import { scriptFontClass } from '@/features/regions/script-fonts';
import { mediaUrl } from '@/lib/site';

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

export default async function RegionPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const page = await getRegionPageCached((await params).region);
  if (!page) notFound();
  const { region, album, most_wanted: mostWanted, curated } = page;
  // D-157: each type's inventory as See all draws it, the state fixed: its first 24 cards and filter counts, from the
  // same cached store_browse() entries as /clothing?state=… (one read per type, shared with See all)
  const query = inStatePage(parseBrowseQuery({}), region.slug);
  const [policy, ...pages] = await Promise.all([
    getStorePolicyCached(),
    ...PRODUCT_TYPES.map((t) => browseCached(toBrowseFilter(t, query, 0, PAGE))),
  ]);
  const slugOf = (type: ProductType): string => PRODUCT_TYPE_PATH[type].slice(1);
  const tabs = PRODUCT_TYPES.map((t, i) => ({ slug: slugOf(t), label: PRODUCT_TYPE_LABEL[t], count: pages[i]?.total ?? 0 }));
  const quickDays = policy.quick_delivery_on ? policy.quick_delivery_days_max : null;
  const views = Object.fromEntries(
    PRODUCT_TYPES.map((t, i) => {
      const initial = pages[i];
      return [
        slugOf(t),
        initial && initial.total > 0 ? (
          <BrowseView productType={t} title={PRODUCT_TYPE_LABEL[t]} initialQuery={query} initial={initial} quickDays={quickDays} />
        ) : (
          <p className="bg-surface font-body rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
            {t === 'clothing' ? 'New pieces are on their way.' : `${PRODUCT_TYPE_LABEL[t]} from ${region.name} ${t === 'food' ? 'is' : 'are'} coming soon.`}
          </p>
        ),
      ];
    }),
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
            first={(tabs.find((t) => t.count > 0) ?? tabs[0])?.slug ?? 'clothing'}
            region={region.slug}
            views={views}
          />
        </>
      )}
    </div>
  );
}
