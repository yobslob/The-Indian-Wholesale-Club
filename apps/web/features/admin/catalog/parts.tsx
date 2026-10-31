import 'server-only';

import Link from 'next/link';
import { cache } from 'react';

import {
  countProductsByStatus,
  listWeightsToCheck,
  pageAdminProducts,
  type AdminProductFilter,
} from '@repo/db/admin';
import { formatUsd, type Wears } from '@repo/shared/domain';

import { ArchiveUnready, AssignAndPublish } from '../bulk/assign-publish';
import { PRODUCT_STATUS, StatusChip } from '../chips';
import { requireAdminPage } from '../guard';
import { listingTabs } from '../listing-tabs';
import { Pager } from '../pager/pager';
import { Cell, linkButton, rupees, Table, Tabs } from '../ui';
import { WearsPicker } from '../wears-picker';
import { WeightSummary, WeightsToCheck } from '../weights-to-check';

import type { IwcClient } from '@repo/db';

/**
 * The Products page's parts (catalog/page.tsx), each read on its own inside a `Section`: the tabs and their counts,
 * the rows, the weights to check. One slow or failed read leaves the others on screen. Each takes the admin's client
 * from the request's one access check (guard.ts), never as a prop.
 */

/** Once per request: the tabs' Weights count and the Weights rows share one call (D-129). */
const weightsPage = cache((client: IwcClient, offset: number, limit: number) =>
  listWeightsToCheck(client, offset, limit),
);

type Paging = { page: number; size: number; offset: number; params: Record<string, string> };

/** The tabs with their counts, then the tab's own bulk buttons (D-120, D-146). */
export async function CatalogTabs({
  current,
  weights,
}: {
  current: string;
  /** The Weights to check tab's page (its rows come from the same call), else null. */
  weights: Paging | null;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [counts, w] = await Promise.all([
    countProductsByStatus(client),
    weights ? weightsPage(client, weights.offset, weights.size) : weightsPage(client, 0, 0),
  ]);
  return (
    <>
      <Tabs items={listingTabs({ ...counts, weights: w.total })} current={current} />
      {/* D-146: every missing weight assigned, every shown weight accepted, every ready draft live */}
      {weights && w.total > 0 ? <AssignAndPublish accept label="Assign all and publish" /> : null}
      {current === 'draft' && counts.draft > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* D-120, D-146: weighs what has no weight, then publishes; the drafts that cannot go live can be archived */}
          <AssignAndPublish accept={false} label="Publish all drafts" />
          <ArchiveUnready />
        </div>
      ) : null}
    </>
  );
}

/** Weights to check (D-129): a page of listings whose price rests on a missing or doubtful weight. */
export async function WeightRows({ paging }: { paging: Paging }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const weights = await weightsPage(client, paging.offset, paging.size);
  const pager = (keys: boolean): React.JSX.Element => (
    <Pager
      list="products"
      path="/admin/catalog"
      params={paging.params}
      page={paging.page}
      size={paging.size}
      total={weights.total}
      keys={keys}
    />
  );
  return (
    <>
      {pager(false)}
      <WeightsToCheck rows={weights.rows} missing={weights.missing} />
      {pager(true)}
    </>
  );
}

/** A page of products with how many match (D-140), and Download Excel for the same view (D-128). */
export async function ProductRows({
  filter,
  paging,
  filtered,
  exportHref,
}: {
  filter: AdminProductFilter;
  paging: Paging;
  filtered: boolean;
  exportHref: string;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const products = await pageAdminProducts(client, {
    ...filter,
    offset: paging.offset,
    limit: paging.size,
  });
  const pager = (keys: boolean): React.JSX.Element => (
    <Pager
      list="products"
      path="/admin/catalog"
      params={paging.params}
      page={paging.page}
      size={paging.size}
      total={products.total}
      keys={keys}
    />
  );
  const matches = filtered
    ? products.total === 0
      ? 'No products match.'
      : `${products.total.toLocaleString('en-US')} match (the tab counts are every product).`
    : null;
  return (
    <>
      <ExportLine exportHref={exportHref} matches={matches} />
      {pager(false)}
      <Table head={HEAD}>
        {products.rows.map((p) => (
          <tr key={p.id}>
            <Cell>
              <Link href={`/admin/catalog/${p.id}`} className="font-semibold">
                {p.name}
              </Link>
              {p.is_placeholder ? <span className="text-caution ml-1 text-xs">(demo)</span> : null}
              {p.is_us_stock ? (
                <span className="text-ink-muted ml-1 text-xs">(in the US)</span>
              ) : null}
            </Cell>
            <Cell>{p.product_type}</Cell>
            <Cell>
              <StatusChip map={PRODUCT_STATUS} status={p.status} />
              {p.coming_soon ? (
                <span className="text-ink-muted ml-1 text-xs">coming soon on the store</span>
              ) : null}
            </Cell>
            <Cell>{p.region?.name ?? 'All states'}</Cell>
            <Cell>{p.vendor?.shop_name}</Cell>
            <Cell>{formatUsd(p.price_cents)}</Cell>
            <Cell>{rupees(p.shop_price_paise)}</Cell>
            <Cell>
              <WeightSummary
                variants={p.variants}
                type={p.product_type}
                categoryWeightG={p.category?.default_weight_g ?? null}
              />
            </Cell>
            <Cell>
              {p.product_type === 'clothing' ? (
                <WearsPicker productId={p.id} wears={p.wears as Wears | null} />
              ) : null}
            </Cell>
            <Cell>
              {p.variants.reduce((n, v) => n + v.qty_listed, 0)} /{' '}
              {p.variants.reduce((n, v) => n + v.qty_reserved, 0)}
            </Cell>
          </tr>
        ))}
      </Table>
      {pager(true)}
    </>
  );
}

const HEAD = [
  'Product',
  'Type',
  'Status',
  'Region',
  'Shop',
  'Price',
  'Shop price',
  'Weight',
  'For',
  'Listed / reserved',
];

/** The match count and Download Excel (a plain link: a file, not a page). */
export function ExportLine({
  exportHref,
  matches,
}: {
  exportHref: string;
  matches: string | null;
}): React.JSX.Element {
  return (
    <p className="text-ink-muted flex flex-wrap items-center gap-x-4 text-sm">
      {matches ? <span>{matches}</span> : null}
      <a href={exportHref} className={`${linkButton} text-ink`} download>
        Download Excel
      </a>
    </p>
  );
}

/** While rows load: the table's head and a few grey lines, so the page keeps its shape. */
export function RowsLoading(): React.JSX.Element {
  return (
    <div aria-busy="true" className="space-y-2">
      <p role="status" className="text-ink-muted text-sm">
        Loading products…
      </p>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="bg-line/40 h-10 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
