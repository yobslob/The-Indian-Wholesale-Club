import { listCategories, listRegionChoices, listShopChoices } from '@repo/db/admin';
import { PRODUCT_TYPE_LABEL } from '@repo/shared/domain';

import {
  CatalogTabs,
  ExportLine,
  ProductRows,
  RowsLoading,
  WeightRows,
} from '@/features/admin/catalog/parts';
import { requireAdminPage } from '@/features/admin/guard';
import { listingTabs } from '@/features/admin/listing-tabs';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { ProductFilterBar } from '@/features/admin/product-filter-bar';
import {
  hasProductFilters,
  parseProductView,
  productViewQuery,
  toAdminFilter,
} from '@/features/admin/product-filters';
import { Section } from '@/features/admin/section';
import { PageHead, Tabs } from '@/features/admin/ui';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Catalog: every product with admin-only fields (shop, shop price, stock), optionally one status (the tabs), in pages
 * with the total and page numbers (D-140), so a catalogue of thousands is never one long page and every row is
 * reachable. The US clearance tab lists pieces already in the US (D-072): drafts made from returns and cancels,
 * published once checked. The heading, tabs and filters show at once; the tab counts and the rows each load in their
 * own section (features/admin/section.tsx), so a busy database leaves the page standing with Load again on that part.
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
  const paging = { page, size, offset, params: plainParams(params) };
  const current = weightsView ? 'weights' : usStock ? 'us' : (status ?? 'all');
  // without their counts while they load, and if the counts fail (the tabs never go missing)
  const plainTabs = <Tabs items={listingTabs()} current={current} />;
  const tabs = (
    <Section fallback={plainTabs} failed={plainTabs}>
      <CatalogTabs current={current} weights={weightsView ? paging : null} />
    </Section>
  );

  if (weightsView)
    return (
      <div className="space-y-4">
        <PageHead title="Products" />
        {tabs}
        <Section fallback={<RowsLoading />}>
          <WeightRows paging={paging} />
        </Section>
      </div>
    );

  // D-136: the filters' choices, a few short lists; without them the filters still work, their lists just stay empty
  const [regions, categories, shops] = await Promise.all([
    listRegionChoices(client).catch(() => []),
    listCategories(client).catch(() => []),
    listShopChoices(client).catch(() => []),
  ]);
  const exportQuery = productViewQuery({ ...view, sort: 'updated' });
  const exportHref = `/admin/catalog/export${exportQuery ? `?${exportQuery}` : ''}`;
  const keep: Record<string, string> = {
    ...(status ? { status } : {}),
    ...(usStock ? { us: '1' } : {}),
  };
  const tabQuery = new URLSearchParams(keep).toString();
  const filtered = hasProductFilters(view) || view.q !== '';

  return (
    <div className="space-y-4">
      <PageHead title="Products" />
      {tabs}
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
          wears: view.wears ?? '',
        }}
        keep={{ ...keep, ...(paging.params.size ? { size: paging.params.size } : {}) }}
        regions={regions.map((r) => ({ value: r.id, label: r.name }))}
        categories={categories.map((c) => ({
          value: c.id,
          label: `${c.name} (${PRODUCT_TYPE_LABEL[c.product_type]})`,
          type: c.product_type,
        }))}
        shops={shops.map((v) => ({ value: v.id, label: v.shop_name }))}
        clearHref={filtered ? `/admin/catalog${tabQuery ? `?${tabQuery}` : ''}` : null}
      />
      <Section
        fallback={
          <>
            <ExportLine exportHref={exportHref} matches={null} />
            <RowsLoading />
          </>
        }
      >
        <ProductRows
          filter={toAdminFilter(view)}
          paging={paging}
          filtered={filtered}
          exportHref={exportHref}
        />
      </Section>
    </div>
  );
}
