import { listCategories, listCategoriesToCheck } from '@repo/db/admin';

import { RowsLoading } from '@/features/admin/catalog/parts';
import { CategoriesList } from '@/features/admin/categories/categories-list';
import { categoryProposals } from '@/features/admin/categories/proposals';
import { requireAdminPage } from '@/features/admin/guard';
import { listingTabs } from '@/features/admin/listing-tabs';
import { Section } from '@/features/admin/section';
import { Empty, PageHead, Tabs } from '@/features/admin/ui';

/**
 * Categories to check (founder, 2026-10-24: "everything in its category, not shown in someone else's"): food and home
 * listings whose names plainly read as another category of their type (a chutney under Masala blends, black cardamom
 * under Papad & wadi), and the ones that are not their type at all (dog chews under Snacks, hair oil, Mysore pak under
 * Home & gifts). Nothing changes until an admin ticks and moves or archives. The heading and tabs show at once; the
 * listings load in their own section.
 */
export default async function CategoriesToCheckPage(): Promise<React.JSX.Element> {
  await requireAdminPage();
  return (
    <div className="space-y-4">
      <PageHead
        title="Products"
        sub="Food and home listings whose names say another category, or not their type at all. Check the category each would move to, change it if you like, then move the ticked ones."
      />
      <Tabs items={listingTabs()} current="categories" />
      <Section fallback={<RowsLoading />}>
        <Proposals />
      </Section>
    </div>
  );
}

async function Proposals(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [listings, all] = await Promise.all([
    listCategoriesToCheck(client),
    listCategories(client),
  ]);
  const categories = all
    .filter((c) => c.is_active)
    .map(({ id, slug, name, product_type }) => ({ id, slug, name, product_type }));
  const proposals = categoryProposals(listings, categories);
  return proposals.length === 0 ? (
    <Empty>Every food and home listing is in a category its name fits.</Empty>
  ) : (
    <CategoriesList proposals={proposals} categories={categories} />
  );
}
