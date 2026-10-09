import Link from 'next/link';

import { listRegionsAdmin } from '@repo/db/admin';

import { approveRegionAction } from '@/features/admin/actions/regions';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Cell, PageHead, Table } from '@/features/admin/ui';

/** Regions (admin.md): all 36, their content status (D-019) and whether they are live. */
export default async function RegionsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const regions = await listRegionsAdmin(client);
  return (
    <div className="space-y-4">
      <PageHead title="Regions" />
      <p className="text-ink-muted">
        Greeting, tagline and story show to customers only after approval (D-019).
      </p>
      <Table head={['Region', 'Greeting', 'Content', 'Live', '']}>
        {regions.map((r) => (
          <tr key={r.id}>
            <Cell>
              <Link href={`/admin/regions/${r.id}`} className="underline">
                {r.name}
              </Link>
            </Cell>
            <Cell>{[r.greeting_native, r.greeting_latin].filter(Boolean).join(' · ') || '—'}</Cell>
            <Cell className={r.content_status === 'draft' ? 'text-caution' : ''}>
              {r.content_status}
            </Cell>
            <Cell>{r.is_live ? 'yes' : 'no'}</Cell>
            <Cell>
              {r.content_status === 'draft' ? (
                <form action={approveRegionAction.bind(null, r.id)}>
                  <button type="submit" className={button}>
                    Approve
                  </button>
                </form>
              ) : null}
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
