import Link from 'next/link';
import { cache } from 'react';

import { countProductsByStatus, getPricingSettings, listStaleVariants } from '@repo/db/admin';
import { siteLabel } from '@repo/shared/sourcing';

import { RowsLoading } from '@/features/admin/catalog/parts';
import { requireAdminPage } from '@/features/admin/guard';
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
 * Re-check (D-096): the quantities to re-check with the shops. Listings come from the importer and the runner (D-187,
 * Y-4). The tabs' counts and the list (in pages, D-140) load in their own sections.
 */
export default async function ListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const params = await searchParams;
  const staleDays = (await getPricingSettings(client)).stale_listing_days;

  // without their counts while they load, and if the counts fail (the tabs never go missing)
  const plainTabs = <Tabs items={listingTabs()} current="recheck" />;
  return (
    <>
      <PageHead title="Products" />
      <Section fallback={plainTabs} failed={plainTabs}>
        <ListingTabs staleDays={staleDays} />
      </Section>
      <Section fallback={<RowsLoading />}>
        <Recheck
          staleDays={staleDays}
          paging={{ ...(await readPaging('recheck', params)), params: plainParams(params) }}
        />
      </Section>
    </>
  );
}

/** Once per request: the Re-check tab's count and its list share one read. */
const staleVariants = cache((client: IwcClient) => listStaleVariants(client));

async function ListingTabs({ staleDays }: { staleDays: number | null }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [counts, stale] = await Promise.all([
    countProductsByStatus(client),
    staleDays === null ? Promise.resolve(null) : staleVariants(client),
  ]);
  return (
    <Tabs
      items={listingTabs({ ...counts, recheck: stale ? stale.length : null })}
      current="recheck"
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
                <Cell>{v.site ? siteLabel(v.site) : ''}</Cell>
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
