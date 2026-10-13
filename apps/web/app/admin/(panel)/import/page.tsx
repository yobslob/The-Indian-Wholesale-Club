import Link from 'next/link';

import {
  getPricingSettings,
  listCategories,
  listRegionsAdmin,
  listSourcedProducts,
} from '@repo/db/admin';
import { formatUsd, pricingSettingsFrom } from '@repo/shared/domain';
import { siteLabel } from '@repo/shared/sourcing';

import { PRODUCT_STATUS, StatusChip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { Importer } from '@/features/admin/import/importer';
import { Cell, PageHead, rupees, Sub, Table, When } from '@/features/admin/ui';

/** Copying a product's photos from the shop can take a while. */
export const maxDuration = 60;

/**
 * Import from online shops (D-110): pilot listings copied from Myntra, Amazon India, Flipkart or any shop's product
 * page, with the shop's photos, words and price; and every imported listing with the date its price was last checked
 * (open the page, click the button again to update it).
 */
export default async function ImportPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [regions, categories, settings, sourced] = await Promise.all([
    listRegionsAdmin(client),
    listCategories(client),
    getPricingSettings(client),
    listSourcedProducts(client),
  ]);
  const data = {
    regions: regions.map((r) => ({ id: r.id, slug: r.slug, name: r.name })),
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      product_type: c.product_type,
      is_active: c.is_active,
      default_weight_g: c.default_weight_g,
    })),
    pricing: pricingSettingsFrom(settings as unknown as Record<string, unknown>),
  };

  return (
    <>
      <PageHead
        title="Import from shops"
        sub="Pilot listings from Indian online shops: their photos, words and today's price, ordered to the hub once sold."
        actions={
          <Link href="/admin/import/auto" className="underline">
            Auto-sourcing: targets, shops, weekly checks
          </Link>
        }
      />
      <Importer data={data} />
      <section aria-labelledby="imported" className="mt-10 space-y-3">
        <h2 id="imported" className="font-heading text-[19px] font-semibold">
          Imported ({sourced.length}) · price checked longest ago first
        </h2>
        {sourced.length === 0 ? (
          <p className="text-ink-muted">Nothing imported yet.</p>
        ) : (
          <Table
            head={[
              'Product',
              'Shop',
              { label: 'Shop price', right: true },
              { label: 'Sells for', right: true },
              'Checked',
              '',
            ]}
          >
            {sourced.map((p) => (
              <tr key={p.id}>
                <Cell>
                  <Link href={`/admin/catalog/${p.id}`} className="font-semibold underline">
                    {p.name}
                  </Link>
                  <Sub>
                    {p.region?.name} · <StatusChip map={PRODUCT_STATUS} status={p.status} />
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
      </section>
    </>
  );
}
