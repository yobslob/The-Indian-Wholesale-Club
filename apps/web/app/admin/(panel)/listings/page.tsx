import Link from 'next/link';

import { countProductsByStatus, getPricingSettings, listCategories, listStaleVariants, listVendors } from '@repo/db/admin';
import { pricingSettingsFrom } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { AddMany } from '@/features/admin/listing/add-many';
import { NewListing, type ListingFormData } from '@/features/admin/listing/new-listing';
import { listingTabs } from '@/features/admin/listing-tabs';
import { Cell, PageHead, Table, Tabs, When } from '@/features/admin/ui';

type SearchParams = Promise<{ view?: string }>;

/**
 * Listings (D-096, flows.md §2): a new listing in one step (photos, options, live price, Save draft / Publish), Add
 * many (a batch of photos becomes drafts), and the quantities to re-check with the shops. Drafts, Live and Paused are
 * the catalog's views of the same products.
 */
export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { view } = await searchParams;
  const current = view === 'many' || view === 'recheck' ? view : 'new';
  const [counts, vendors, categories, settings, stale] = await Promise.all([
    countProductsByStatus(client),
    listVendors(client, { status: 'active' }),
    listCategories(client),
    getPricingSettings(client),
    listStaleVariants(client),
  ]);
  const recheck = settings.stale_listing_days === null ? null : stale.length;
  const data: ListingFormData = {
    vendors: vendors.map((v) => ({ id: v.id, shop_name: v.shop_name, town: v.town, region: v.region })),
    categories: categories.map((c) => ({ id: c.id, product_type: c.product_type, name: c.name, is_active: c.is_active, default_weight_g: c.default_weight_g })),
    pricing: pricingSettingsFrom(settings as unknown as Record<string, unknown>),
  };

  return (
    <>
      <PageHead title="Listings" />
      <Tabs items={listingTabs({ ...counts, recheck })} current={current === 'many' ? 'many' : current === 'recheck' ? 'recheck' : 'new'} />
      {current === 'new' ? <NewListing data={data} /> : null}
      {current === 'many' ? <AddMany data={data} /> : null}
      {current === 'recheck' ? (
        <section aria-labelledby="recheck" className="space-y-3">
          <h2 id="recheck" className="font-heading text-[19px] font-semibold">
            Quantities to re-check with the shops ({stale.length})
          </h2>
          {settings.stale_listing_days === null ? (
            <p className="text-ink-muted">
              Set how many days a quantity stays fresh (&quot;stale after&quot;) in{' '}
              <Link href="/admin/settings" className="underline">
                Settings
              </Link>{' '}
              to see this list.
            </p>
          ) : stale.length === 0 ? (
            <p className="text-ink-muted">Every live quantity was confirmed in the last {settings.stale_listing_days} days.</p>
          ) : (
            <Table head={['Product', 'Option', 'Shop', { label: 'Pieces', right: true }, 'Confirmed']}>
              {stale.map((v) => (
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
          )}
        </section>
      ) : null}
    </>
  );
}
