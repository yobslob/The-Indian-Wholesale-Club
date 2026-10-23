import { type ProductType } from '@repo/shared/domain';

import { PAGE, toBrowseFilter, type BrowseQuery } from './browse-query';
import { BrowseView } from './browse-view';
import { browseCached, getStorePolicyCached } from './data';
import { TypeToggle } from './type-toggle';

/**
 * /clothing, /food and /home-and-gifts (D-106), the "See all" pages behind every row (D-062): every live product of
 * one type, newest first. The page is built once per state, category and Show more (cached, PR-1) from one
 * store_browse() read: the cards drawn, the total and the filter counts. D-136: the filters (category, state, price,
 * size, sort) sit in a panel on the left and change only the cards (browse-view.tsx), as does Show more.
 */
export async function BrowseByType({
  productType,
  title,
  emptyText,
  query,
}: {
  productType: ProductType;
  title: string;
  emptyText: string;
  query: BrowseQuery;
}): Promise<React.JSX.Element> {
  // D-154: the policy (STORE_TAG only, like every page's header) says whether "Delivery: in 7 days" is offered
  const [page, policy] = await Promise.all([
    browseCached(toBrowseFilter(productType, query, 0, query.show ?? PAGE)),
    getStorePolicyCached(),
  ]);

  return (
    <div className="space-y-6">
      <TypeToggle current={productType} state={query.state} />
      {page.all_total === 0 ? (
        <>
          <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">
            {title}
          </h1>
          <p className="text-ink-muted">{emptyText}</p>
        </>
      ) : (
        <BrowseView
          productType={productType}
          title={title}
          initialQuery={query}
          initial={page}
          quickDays={policy.quick_delivery_on ? policy.quick_delivery_days_max : null}
        />
      )}
    </div>
  );
}
