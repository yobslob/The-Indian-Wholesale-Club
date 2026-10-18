import { getPricingSettings, listCategories, listRegionsAdmin } from '@repo/db/admin';
import { pricingSettingsFrom } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { importTabs } from '@/features/admin/import/import-tabs';
import { Importer } from '@/features/admin/import/importer';
import { PageHead, Tabs } from '@/features/admin/ui';

/** Copying a product's photos from the shop can take a while. */
export const maxDuration = 60;

/**
 * Import from online shops (D-110): pilot listings copied from Myntra, Amazon India, Flipkart or any shop's product
 * page, with the shop's photos, words and price. Every imported listing is its own paged tab since D-140
 * (/admin/import/listings), so this page loads only what the importer needs.
 */
export default async function ImportPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [regions, categories, settings] = await Promise.all([
    listRegionsAdmin(client),
    listCategories(client),
    getPricingSettings(client),
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
      />
      <Tabs items={importTabs()} current="import" />
      <Importer data={data} />
    </>
  );
}
