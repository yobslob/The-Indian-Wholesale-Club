import Link from 'next/link';

import {
  countProductsByStatus,
  pageAdminProducts,
  listCategories,
  listRegionsAdmin,
  listVendors,
  listWeightsToCheck,
} from '@repo/db/admin';
import { formatUsd, PRODUCT_TYPE_LABEL } from '@repo/shared/domain';

import { PRODUCT_STATUS, StatusChip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { listingTabs } from '@/features/admin/listing-tabs';
import { Pager } from '@/features/admin/pager/pager';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { ProductFilterBar } from '@/features/admin/product-filter-bar';
import { hasProductFilters, parseProductView, productViewQuery, toAdminFilter } from '@/features/admin/product-filters';
import { PublishDrafts } from '@/features/admin/publish-drafts';
import { Cell, linkButton, PageHead, rupees, Table, Tabs } from '@/features/admin/ui';
import { WeightSummary, WeightsToCheck } from '@/features/admin/weights-to-check';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Catalog: every product with admin-only fields (shop, shop price, stock), optionally one status (the tabs), in pages
 * with the total and page numbers (D-140), so a catalogue of thousands is never one long page and every row is
 * reachable. The US
 * clearance tab lists pieces already in the US (D-072): drafts made from returns and cancels, published once checked.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const params = await searchParams;
  const view = parseProductView(params);
  const { status, usStock } = view;
  const weightsView = params.weights === '1';
  const { page, size, offset } = await readPaging('products', params);
  const [products, counts, weights, regions, categories, shops] = await Promise.all([
    weightsView
      ? Promise.resolve({ rows: [], total: 0 })
      : pageAdminProducts(client, { ...toAdminFilter(view), offset, limit: size }),
    countProductsByStatus(client),
    // D-129: the count for the tab; the rows only on the Weights to check tab
    listWeightsToCheck(client, weightsView ? offset : 0, weightsView ? size : 0),
    // D-136: the filters' choices
    weightsView ? Promise.resolve([]) : listRegionsAdmin(client),
    weightsView ? Promise.resolve([]) : listCategories(client),
    weightsView ? Promise.resolve([]) : listVendors(client),
  ]);
  const pagerParams = plainParams(params);
  const pager = (keys: boolean, total: number): React.JSX.Element => (
    <Pager list="products" path="/admin/catalog" params={pagerParams} page={page} size={size} total={total} keys={keys} />
  );

  const exportQuery = productViewQuery({ ...view, sort: 'updated' });
  const exportHref = `/admin/catalog/export${exportQuery ? `?${exportQuery}` : ''}`;
  const keep: Record<string, string> = { ...(status ? { status } : {}), ...(usStock ? { us: '1' } : {}) };
  const tabQuery = new URLSearchParams(keep).toString();
  const filtered = hasProductFilters(view) || view.q !== '';

  const tabs = listingTabs({ ...counts, weights: weights.total });
  if (weightsView)
    return (
      <div className="space-y-4">
        <PageHead title="Products" />
        <Tabs items={tabs} current="weights" />
        {pager(false, weights.total)}
        <WeightsToCheck rows={weights.rows} missing={weights.missing} />
        {pager(true, weights.total)}
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHead title="Products" />
      <Tabs items={tabs} current={usStock ? 'us' : (status ?? 'all')} />
      {status === 'draft' && !usStock && counts.draft > 0 ? <PublishDrafts /> : null}
      {usStock ? (
        <p className="text-ink-muted text-sm">
          Returned and cancelled pieces already in the US, as drafts at the clearance price. Check
          each piece in hand, then publish it: it ships at once, without a cycle.
        </p>
      ) : null}
      <ProductFilterBar
        values={{
          q: view.q,
          type: view.type ?? '',
          region: view.region ?? '',
          category: view.category ?? '',
          shop: view.shop ?? '',
          min: view.min !== undefined ? String(view.min) : '',
          max: view.max !== undefined ? String(view.max) : '',
          sort: view.sort,
        }}
        keep={{ ...keep, ...(pagerParams.size ? { size: pagerParams.size } : {}) }}
        regions={regions.map((r) => ({ value: r.id, label: r.name }))}
        categories={categories.map((c) => ({
          value: c.id,
          label: `${c.name} (${PRODUCT_TYPE_LABEL[c.product_type]})`,
          type: c.product_type,
        }))}
        shops={shops.map((v) => ({ value: v.id, label: v.shop_name }))}
        clearHref={filtered ? `/admin/catalog${tabQuery ? `?${tabQuery}` : ''}` : null}
      />
      <p className="text-ink-muted flex flex-wrap items-center gap-x-4 text-sm">
        {filtered ? <span>{products.total === 0 ? 'No products match.' : `${products.total.toLocaleString('en-US')} match (the tab counts are every product).`}</span> : null}
        {/* D-128: the six price columns of this view as an Excel sheet (a plain link: a file, not a page) */}
        <a href={exportHref} className={`${linkButton} text-ink`} download>
          Download Excel
        </a>
      </p>
      {pager(false, products.total)}
      <Table
        head={[
          'Product',
          'Type',
          'Status',
          'Region',
          'Shop',
          'Price',
          'Shop price',
          'Weight',
          'Listed / reserved',
        ]}
      >
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
              {p.variants.reduce((n, v) => n + v.qty_listed, 0)} /{' '}
              {p.variants.reduce((n, v) => n + v.qty_reserved, 0)}
            </Cell>
          </tr>
        ))}
      </Table>
      {pager(true, products.total)}
    </div>
  );
}
