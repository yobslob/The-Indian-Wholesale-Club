import Link from 'next/link';

import { listRegionsAdmin, listSourcedSites, pageSourcedProducts, SOURCED_SORTS, type SourcedSort } from '@repo/db/admin';
import { formatUsd, PRODUCT_TYPE_LABEL, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';
import { siteLabel } from '@repo/shared/sourcing';

import { PRODUCT_STATUS, StatusChip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { importTabs } from '@/features/admin/import/import-tabs';
import { ListFilters } from '@/features/admin/pager/list-filters';
import { Pager } from '@/features/admin/pager/pager';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { Cell, Empty, PageHead, rupees, Sub, Table, Tabs, When } from '@/features/admin/ui';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUSES = ['draft', 'live', 'paused'] as const;
const CHECKED_DAYS = { week: 7, month: 30 } as const;
const SORT_LABEL: Record<SourcedSort, string> = {
  checked: 'Price checked longest ago',
  newest: 'Newest imported',
  name: 'Name',
  'price-desc': 'Price, highest first',
};

/**
 * Every imported listing (D-110, D-140), in pages with the real total: search, shop, state, type, status, "price not
 * checked for a week / a month", and the sort (the price checked longest ago first unless chosen). Moved off the
 * importer's page, which listed only the first 100 under a heading that said 100.
 */
export default async function ImportedListingsPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const params = plainParams(await searchParams);
  const { page, size, offset } = await readPaging('imported', params);
  const q = (params.q ?? '').slice(0, 100);
  const type = PRODUCT_TYPES.find((t) => t === params.type) as ProductType | undefined;
  const status = STATUSES.find((s) => s === params.status);
  const sort = SOURCED_SORTS.find((s) => s === params.sort) ?? 'checked';
  const checked = params.checked === 'week' || params.checked === 'month' ? params.checked : '';
  const region = params.region ?? '';
  const checkedBefore = checked ? new Date(Date.now() - CHECKED_DAYS[checked] * 86_400_000).toISOString() : undefined;

  const [listings, regions, sites] = await Promise.all([
    pageSourcedProducts(client, {
      search: q || undefined,
      site: params.shop || undefined,
      regionId: region && region !== 'none' ? region : undefined,
      noRegion: region === 'none',
      productType: type,
      status,
      checkedBefore,
      sort,
      offset,
      limit: size,
    }),
    listRegionsAdmin(client),
    listSourcedSites(client),
  ]);
  const filtered = Boolean(q || type || status || checked || region || params.shop || params.sort);
  const pager = (keys: boolean): React.JSX.Element => (
    <Pager list="imported" path="/admin/import/listings" params={params} page={page} size={size} total={listings.total} keys={keys} />
  );

  return (
    <>
      <PageHead title="Import from shops" sub="Every listing imported from a shop, with the date its price was last checked." />
      <Tabs items={importTabs(listings.total)} current="listings" />
      <ListFilters
        q={q}
        placeholder="Search imported listings"
        keep={params.size ? { size: params.size } : {}}
        clearHref={filtered ? '/admin/import/listings' : null}
        selects={[
          {
            name: 'shop',
            label: 'Shop',
            value: params.shop ?? '',
            options: [{ value: '', label: 'All shops' }, ...sites.map((s) => ({ value: s, label: siteLabel(s) }))],
          },
          {
            name: 'region',
            label: 'State',
            value: region,
            options: [
              { value: '', label: 'All states' },
              { value: 'none', label: 'All-India only' },
              ...regions.map((r) => ({ value: r.id, label: r.name })),
            ],
          },
          {
            name: 'type',
            label: 'Type',
            value: type ?? '',
            options: [{ value: '', label: 'All types' }, ...PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABEL[t] }))],
          },
          {
            name: 'status',
            label: 'Status',
            value: status ?? '',
            options: [
              { value: '', label: 'Any status' },
              { value: 'live', label: 'Live' },
              { value: 'draft', label: 'Draft' },
              { value: 'paused', label: 'Paused' },
            ],
          },
          {
            name: 'checked',
            label: 'Price checked',
            value: checked,
            options: [
              { value: '', label: 'Checked any time' },
              { value: 'week', label: 'Not checked for a week' },
              { value: 'month', label: 'Not checked for a month' },
            ],
          },
          {
            name: 'sort',
            label: 'Sort by',
            value: sort === 'checked' ? '' : sort,
            options: SOURCED_SORTS.map((s) => ({ value: s === 'checked' ? '' : s, label: SORT_LABEL[s] })),
          },
        ]}
      />
      {pager(false)}
      {listings.rows.length === 0 ? (
        <Empty>{filtered ? 'No imported listing matches.' : 'Nothing imported yet.'}</Empty>
      ) : (
        <Table head={['Product', 'Shop', { label: 'Shop price', right: true }, { label: 'Sells for', right: true }, 'Checked', '']}>
          {listings.rows.map((p) => (
            <tr key={p.id}>
              <Cell>
                <Link href={`/admin/catalog/${p.id}`} className="font-semibold underline">
                  {p.name}
                </Link>
                <Sub>
                  {p.region?.name ?? 'All states'} · <StatusChip map={PRODUCT_STATUS} status={p.status} />
                  {p.source_in_stock === false ? ' · sold out at the shop' : ''}
                </Sub>
              </Cell>
              <Cell>{p.source_site ? siteLabel(p.source_site) : ''}</Cell>
              <Cell className="text-right">{rupees(p.shop_price_paise)}</Cell>
              <Cell className="text-right">{formatUsd(p.price_cents)}</Cell>
              <Cell>
                <When iso={p.source_checked_at} />
              </Cell>
              <Cell>
                {p.source_url ? (
                  <a href={p.source_url} target="_blank" rel="noreferrer" className="underline">
                    Open to check
                  </a>
                ) : null}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
      {pager(true)}
    </>
  );
}
