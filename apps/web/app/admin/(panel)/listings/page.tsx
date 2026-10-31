import Link from 'next/link';
import { cache } from 'react';

import {
  countProductsByStatus,
  getPricingSettings,
  listCategories,
  listStaleVariants,
  listVendors,
} from '@repo/db/admin';
import { pricingSettingsFrom } from '@repo/shared/domain';

import { RowsLoading } from '@/features/admin/catalog/parts';
import { requireAdminPage } from '@/features/admin/guard';
import { AddMany } from '@/features/admin/listing/add-many';
import { NewListing, type ListingFormData } from '@/features/admin/listing/new-listing';
import { listingTabs } from '@/features/admin/listing-tabs';
import { Pager } from '@/features/admin/pager/pager';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { Section } from '@/features/admin/section';
import { Cell, PageHead, Table, Tabs, When } from '@/features/admin/ui';

import type { IwcClient } from '@repo/db';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Paging = { page: number; size: number; offset: number; params: Record<string, string> };

/**
 * Listings (D-096, flows.md §2): a new listing in one step (photos, options, live price, Save draft / Publish), Add
 * many (a batch of photos becomes drafts), and the quantities to re-check with the shops. Drafts, Live and Paused are
 * the catalog's views of the same products. The form shows as soon as its choices are read; the tabs' counts and the
 * re-check list (in pages, D-140) load in their own sections.
 */
export default async function ListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const params = await searchParams;
  const view = plainParams(params).view;
  const current = view === 'many' || view === 'recheck' ? view : 'new';
  const [vendors, categories, settings] = await Promise.all([
    listVendors(client, { status: 'active' }),
    listCategories(client),
    getPricingSettings(client),
  ]);
  const staleDays = settings.stale_listing_days;
  const data: ListingFormData = {
    vendors: vendors.map((v) => ({
      id: v.id,
      shop_name: v.shop_name,
      town: v.town,
      region: v.region,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      product_type: c.product_type,
      name: c.name,
      is_active: c.is_active,
      default_weight_g: c.default_weight_g,
    })),
    pricing: pricingSettingsFrom(settings as unknown as Record<string, unknown>),
  };

  // without their counts while they load, and if the counts fail (the tabs never go missing)
  const plainTabs = <Tabs items={listingTabs()} current={current} />;
  return (
    <>
      <PageHead title="Listings" />
      <Section fallback={plainTabs} failed={plainTabs}>
        <ListingTabs current={current} staleDays={staleDays} />
      </Section>
      {current === 'new' ? <NewListing data={data} /> : null}
      {current === 'many' ? <AddMany data={data} /> : null}
      {current === 'recheck' ? (
        <Section fallback={<RowsLoading />}>
          <Recheck
            staleDays={staleDays}
            paging={{ ...(await readPaging('recheck', params)), params: plainParams(params) }}
          />
        </Section>
      ) : null}
    </>
  );
}

/** Once per request: the Re-check tab's count and its list share one read. */
const staleVariants = cache((client: IwcClient) => listStaleVariants(client));

async function ListingTabs({
  current,
  staleDays,
}: {
  current: string;
  staleDays: number | null;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [counts, stale] = await Promise.all([
    countProductsByStatus(client),
    staleDays === null ? Promise.resolve(null) : staleVariants(client),
  ]);
  return (
    <Tabs
      items={listingTabs({ ...counts, recheck: stale ? stale.length : null })}
      current={current}
    />
  );
}

async function Recheck({
  staleDays,
  paging,
}: {
  staleDays: number | null;
  paging: Paging;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const stale = staleDays === null ? [] : await staleVariants(client);
  const pager = (keys: boolean): React.JSX.Element => (
    <Pager
      list="recheck"
      path="/admin/listings"
      params={paging.params}
      page={paging.page}
      size={paging.size}
      total={stale.length}
      keys={keys}
    />
  );
  return (
    <section aria-labelledby="recheck" className="space-y-3">
      <h2 id="recheck" className="font-heading text-[19px] font-semibold">
        Quantities to re-check with the shops ({stale.length})
      </h2>
      {staleDays === null ? (
        <p className="text-ink-muted">
          Set how many days a quantity stays fresh (&quot;stale after&quot;) in{' '}
          <Link href="/admin/settings" className="underline">
            Settings
          </Link>{' '}
          to see this list.
        </p>
      ) : stale.length === 0 ? (
        <p className="text-ink-muted">
          Every live quantity was confirmed in the last {staleDays} days.
        </p>
      ) : (
        <>
          {pager(false)}
          <Table
            head={['Product', 'Option', 'Shop', { label: 'Pieces', right: true }, 'Confirmed']}
          >
            {stale.slice(paging.offset, paging.offset + paging.size).map((v) => (
              <tr key={v.variant_id}>
                <Cell>
                  <Link href={`/admin/catalog/${v.product_id}`} className="font-semibold">
                    {v.product_name}
                  </Link>
                </Cell>
                <Cell>{v.label}</Cell>
                <Cell>{v.shop_name}</Cell>
                <Cell className="text-right">{v.qty_listed}</Cell>
                <Cell>{v.qty_confirmed_at ? <When iso={v.qty_confirmed_at} /> : 'never'}</Cell>
              </tr>
            ))}
          </Table>
          {pager(true)}
        </>
      )}
    </section>
  );
}
