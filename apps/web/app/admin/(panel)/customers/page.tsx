import { pageCustomers } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { ListFilters } from '@/features/admin/pager/list-filters';
import { Pager } from '@/features/admin/pager/pager';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { Cell, Empty, PageHead, Table, When } from '@/features/admin/ui';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Customers (US desk): accounts and how many orders each placed, searchable by email, name or phone, in pages with
 * the total (D-140; it stopped at 200). Guests appear only on orders.
 */
export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const params = plainParams(await searchParams);
  const q = (params.q ?? '').slice(0, 80);
  const { page, size, offset } = await readPaging('customers', params);
  const customers = await pageCustomers(client, { search: q || undefined, offset, limit: size });
  const pager = (keys: boolean): React.JSX.Element => (
    <Pager list="customers" path="/admin/customers" params={params} page={page} size={size} total={customers.total} keys={keys} />
  );
  return (
    <div className="space-y-4">
      <PageHead title="Customers" />
      <ListFilters
        q={q}
        placeholder="Email, name or phone"
        keep={params.size ? { size: params.size } : {}}
        clearHref={q ? '/admin/customers' : null}
      />
      {pager(false)}
      {customers.rows.length === 0 ? (
        <Empty>{q ? `No customer matches “${q}”.` : 'No customers yet.'}</Empty>
      ) : (
        <Table head={['Email', 'Name', 'Phone', 'Joined', 'Orders']}>
          {customers.rows.map((c) => (
            <tr key={c.id}>
              <Cell>{c.email}</Cell>
              <Cell>{c.full_name ?? '—'}</Cell>
              <Cell>{c.phone ?? '—'}</Cell>
              <Cell>
                <When iso={c.created_at} />
              </Cell>
              <Cell>{c.orders[0]?.count ?? 0}</Cell>
            </tr>
          ))}
        </Table>
      )}
      {pager(true)}
    </div>
  );
}
