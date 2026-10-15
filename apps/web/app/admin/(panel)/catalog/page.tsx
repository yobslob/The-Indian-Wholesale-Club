import Link from 'next/link';

import { countProductsByStatus, listAdminProducts, listWeightsToCheck } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { PRODUCT_STATUS, StatusChip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { listingTabs } from '@/features/admin/listing-tabs';
import { PublishDrafts } from '@/features/admin/publish-drafts';
import { Cell, input, linkButton, PageHead, rupees, Table, Tabs } from '@/features/admin/ui';
import { WeightSummary, WeightsToCheck } from '@/features/admin/weights-to-check';

type SearchParams = Promise<{ q?: string; status?: string; page?: string; us?: string; weights?: string }>;

const PAGE = 50;

const STATUSES = ['draft', 'live', 'paused', 'archived'] as const;
type Status = (typeof STATUSES)[number];
const isStatus = (s: string | undefined): s is Status => STATUSES.includes(s as Status);

/**
 * Catalog: every product with admin-only fields (shop, shop price, stock), optionally one status (the tabs), 50 to a
 * page with Previous / Next, so a catalogue of hundreds is never one long page and nothing is cut off. The US
 * clearance tab lists pieces already in the US (D-072): drafts made from returns and cancels, published once checked.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) ?? '';
  const status = isStatus(params.status) ? params.status : undefined;
  const usStock = params.us === '1';
  const weightsView = params.weights === '1';
  const page = Math.min(Math.max(Number.parseInt(params.page ?? '1', 10) || 1, 1), 1000);
  // One more than a page tells whether a next page exists.
  const [rows, counts, weights] = await Promise.all([
    weightsView
      ? Promise.resolve([])
      : listAdminProducts(client, {
          search: q || undefined,
          status,
          usStock,
          offset: (page - 1) * PAGE,
          limit: PAGE + 1,
        }),
    countProductsByStatus(client),
    // D-129: the count for the tab; the rows only on the Weights to check tab
    listWeightsToCheck(client, weightsView ? (page - 1) * PAGE : 0, weightsView ? PAGE : 0),
  ]);
  const products = rows.slice(0, PAGE);
  const pageHref = (n: number): string => {
    const query = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(usStock ? { us: '1' } : {}),
      ...(weightsView ? { weights: '1' } : {}),
      ...(n > 1 ? { page: String(n) } : {}),
    });
    return query.size ? `/admin/catalog?${query.toString()}` : '/admin/catalog';
  };

  const exportQuery = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
    ...(usStock ? { us: '1' } : {}),
  });
  const exportHref = `/admin/catalog/export${exportQuery.size ? `?${exportQuery.toString()}` : ''}`;

  const tabs = listingTabs({ ...counts, weights: weights.total });
  if (weightsView)
    return (
      <div className="space-y-4">
        <PageHead title="Products" />
        <Tabs items={tabs} current="weights" />
        <WeightsToCheck rows={weights.rows} missing={weights.missing} />
        <nav aria-label="Pages" className="flex items-center gap-4">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={linkButton}>
              ← Previous
            </Link>
          ) : null}
          <span className="text-ink-muted text-sm">Page {page}</span>
          {weights.total > page * PAGE ? (
            <Link href={pageHref(page + 1)} className={linkButton}>
              Next →
            </Link>
          ) : null}
        </nav>
      </div>
    );

  return (
    <div className="space-y-4">
      <PageHead title="Products" />
      <Tabs items={tabs} current={usStock ? 'us' : (status ?? 'all')} />
      {status === 'draft' && !usStock && counts.draft > 0 ? <PublishDrafts /> : null}
      {usStock ? (
        <p className="text-ink-muted text-sm">
          Returned and cancelled pieces already in the US, as drafts at the clearance price. Check each piece in hand,
          then publish it: it ships at once, without a cycle.
        </p>
      ) : null}
      <form className="flex gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {usStock ? <input type="hidden" name="us" value="1" /> : null}
        <input name="q" defaultValue={q} placeholder="Search products" className={`${input} flex-1`} />
        <button type="submit" className={linkButton}>
          Search
        </button>
        {/* D-128: the six price columns of this view as an Excel sheet (a plain link: a file, not a page) */}
        <a href={exportHref} className={linkButton} download>
          Download Excel
        </a>
      </form>
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
        {products.map((p) => (
          <tr key={p.id}>
            <Cell>
              <Link href={`/admin/catalog/${p.id}`} className="font-semibold">
                {p.name}
              </Link>
              {p.is_placeholder ? <span className="text-caution ml-1 text-xs">(demo)</span> : null}
              {p.is_us_stock ? <span className="text-ink-muted ml-1 text-xs">(in the US)</span> : null}
            </Cell>
            <Cell>{p.product_type}</Cell>
            <Cell>
              <StatusChip map={PRODUCT_STATUS} status={p.status} />
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
      <nav aria-label="Pages" className="flex items-center gap-4">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className={linkButton}>
            ← Previous
          </Link>
        ) : null}
        <span className="text-ink-muted text-sm">Page {page}</span>
        {rows.length > PAGE ? (
          <Link href={pageHref(page + 1)} className={linkButton}>
            Next →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
