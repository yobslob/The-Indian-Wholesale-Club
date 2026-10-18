import { listNamesToReview } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { listingTabs } from '@/features/admin/listing-tabs';
import { NamesList } from '@/features/admin/names/names-list';
import { nameProposals } from '@/features/admin/names/proposals';
import { Pager } from '@/features/admin/pager/pager';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { Empty, PageHead, Tabs } from '@/features/admin/ui';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Names to tidy (D-140, plan L1): clothing and home listings whose names still carry a brand or shop, the shop's search
 * words or "with", next to IWC's name for them. Nothing changes until an admin ticks and renames; the old name is kept
 * as the listing's shop title (admin only). Food keeps its brand (D-139).
 */
export default async function NamesToTidyPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const params = plainParams(await searchParams);
  const { page, size, offset } = await readPaging('names', params);
  const proposals = nameProposals(await listNamesToReview(client));
  const shown = proposals.slice(offset, offset + size);
  return (
    <div className="space-y-4">
      <PageHead
        title="Products"
        sub="Names that still carry a brand or shop, or the shop's search words. Check IWC's name, change it if you like, then rename the ticked ones."
      />
      <Tabs items={listingTabs()} current="names" />
      {proposals.length === 0 ? (
        <Empty>Every name is tidy.</Empty>
      ) : (
        <>
          <Pager list="names" path="/admin/catalog/names" params={params} page={page} size={size} total={proposals.length} />
          <NamesList key={`${page}-${size}`} proposals={shown} />
          <Pager list="names" path="/admin/catalog/names" params={params} page={page} size={size} total={proposals.length} keys />
        </>
      )}
    </div>
  );
}
