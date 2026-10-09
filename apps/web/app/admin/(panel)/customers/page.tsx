import { listCustomers } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { Cell, PageTitle, Table, When } from '@/features/admin/ui';

/** Customers (US desk): accounts and how many orders each placed. Guests appear only on orders. */
export default async function CustomersPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const customers = await listCustomers(client);
  return (
    <div className="space-y-4">
      <PageTitle>Customers</PageTitle>
      <Table head={['Email', 'Name', 'Phone', 'Joined', 'Orders']}>
        {customers.map((c) => (
          <tr key={c.id}>
            <Cell>{c.email}</Cell>
            <Cell>{c.full_name ?? '—'}</Cell>
            <Cell>{c.phone ?? '—'}</Cell>
            <Cell><When iso={c.created_at} /></Cell>
            <Cell>{c.orders[0]?.count ?? 0}</Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
