import { listOrderedPieces, listToOrder, listToWeigh, pilotPipelineCounts } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { groupByShop } from '@/features/admin/to-order/group';
import { PipelineList } from '@/features/admin/to-order/pipeline';
import { ToOrderList } from '@/features/admin/to-order/to-order-list';
import { Empty, PageHead, Tabs } from '@/features/admin/ui';

type SearchParams = Promise<{ view?: string }>;

/**
 * The India desk's pieces (D-140, plan F3, A2): **To order** — every sold piece of a paid, open order not yet ordered
 * from its shop, grouped by shop, oldest first, with the shop item in use (D-118) and its price there now; **On the
 * way** — ordered, not at the hub yet; **To weigh** — at the hub, not weighed (D-130). Ordering a piece needs neither
 * its product page nor a cycle (the pilot has none, D-115).
 */
export default async function ToOrderPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const wanted = (await searchParams).view;
  const view = wanted === 'ordered' || wanted === 'weigh' ? wanted : 'order';
  const [toOrder, counts, pieces] = await Promise.all([
    listToOrder(client),
    pilotPipelineCounts(client),
    view === 'ordered' ? listOrderedPieces(client) : view === 'weigh' ? listToWeigh(client) : Promise.resolve([]),
  ]);
  const groups = groupByShop(toOrder);
  const waiting = toOrder.reduce((n, r) => n + r.quantity, 0);
  const tabs = [
    { key: 'order', href: '/admin/to-order', label: 'To order', count: toOrder.length },
    { key: 'ordered', href: '/admin/to-order?view=ordered', label: 'On the way to the hub', count: counts.ordered },
    { key: 'weigh', href: '/admin/to-order?view=weigh', label: 'At the hub, to weigh', count: counts.toWeigh },
  ];

  return (
    <>
      <PageHead
        title="To order"
        sub={
          view !== 'order'
            ? 'Mark a piece at the hub when it arrives, with its weight (one piece, packed) if you can.'
            : waiting
              ? `${toOrder.length} to order${waiting !== toOrder.length ? ` (${waiting} pieces)` : ''} from ${groups.length} shop${groups.length === 1 ? '' : 's'}, oldest first. Order each to the hub, then mark it ordered.`
              : 'Sold pieces wait here until they are ordered from their shop.'
        }
      />
      <Tabs items={tabs} current={view} />
      {view !== 'order' ? (
        <PipelineList rows={pieces} view={view} />
      ) : groups.length === 0 ? (
        <Empty>Nothing to order. Every sold piece is on its way to the hub.</Empty>
      ) : (
        <ToOrderList groups={groups} />
      )}
    </>
  );
}
