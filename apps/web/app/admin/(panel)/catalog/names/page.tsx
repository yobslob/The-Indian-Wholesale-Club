import { listNamesToReview } from '@repo/db/admin';

import { RowsLoading } from '@/features/admin/catalog/parts';
import { requireAdminPage } from '@/features/admin/guard';
import { listingTabs } from '@/features/admin/listing-tabs';
import { NamesList } from '@/features/admin/names/names-list';
import { nameProposals } from '@/features/admin/names/proposals';
import { RenameAll } from '@/features/admin/names/rename-all';
import { Pager } from '@/features/admin/pager/pager';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { Section } from '@/features/admin/section';
import { Empty, PageHead, Tabs } from '@/features/admin/ui';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Names to tidy (D-140, plan L1; D-143): clothing and home listings whose names still carry a brand or shop, or lost words
 * from the shop's title, next to IWC's name for them. Nothing changes until an admin ticks and renames; the old name is kept
 * as the listing's shop title (admin only). Food keeps its brand (D-139). The heading and tabs show at once; the names
 * (every imported listing's, read in pages side by side) load in their own section.
 */
export default async function NamesToTidyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  await requireAdminPage();
  const params = plainParams(await searchParams);
  const paging = await readPaging('names', params);
  return (
    <div className="space-y-4">
      <PageHead
        title="Products"
        sub="Names that still carry a brand or shop, or lost words from the shop's title. Check IWC's name, change it if you like, then rename the ticked ones, or all of them at once."
      />
      <Tabs items={listingTabs()} current="names" />
      <Section fallback={<RowsLoading />}>
        <Names params={params} {...paging} />
      </Section>
    </div>
  );
}

async function Names({
  params,
  page,
  size,
  offset,
}: {
  params: Record<string, string>;
  page: number;
  size: number;
  offset: number;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const proposals = nameProposals(await listNamesToReview(client));
  const shown = proposals.slice(offset, offset + size);
  return proposals.length === 0 ? (
    <Empty>Every name is tidy.</Empty>
  ) : (
    <>
      {/* D-146: every proposal on every page in one press */}
      <RenameAll total={proposals.length} />
      <Pager
        list="names"
        path="/admin/catalog/names"
        params={params}
        page={page}
        size={size}
        total={proposals.length}
      />
      <NamesList key={`${page}-${size}`} proposals={shown} />
      <Pager
        list="names"
        path="/admin/catalog/names"
        params={params}
        page={page}
        size={size}
        total={proposals.length}
        keys
      />
    </>
  );
}
