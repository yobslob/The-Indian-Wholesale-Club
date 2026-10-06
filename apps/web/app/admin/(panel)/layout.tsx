import Link from 'next/link';

import { signOutAction } from '@/features/account/actions';
import { requireAdminPage } from '@/features/admin/guard';

/** Every admin page passes this server check first (admin.md §Access model). */
const SECTIONS = [
  ['/admin', 'Today'],
  ['/admin/orders', 'Orders'],
  ['/admin/returns', 'Returns'],
  ['/admin/cycles', 'Cycles'],
  ['/admin/payouts', 'Payouts'],
  ['/admin/vendors', 'Vendors'],
  ['/admin/listings', 'Listings'],
  ['/admin/catalog', 'Catalog'],
  ['/admin/reviews', 'Reviews'],
  ['/admin/regions', 'Regions'],
  ['/admin/customers', 'Customers'],
  ['/admin/promotions', 'Promotions'],
  ['/admin/insights', 'Insights'],
  ['/admin/settings', 'Settings'],
] as const;

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const { user } = await requireAdminPage();
  return (
    <div className="md:flex">
      {/* Phones: one scrolling row, so the job starts at the top of the screen (the mockup's admin screen). */}
      <nav className="border-line font-ui flex print:hidden items-center gap-x-4 gap-y-1 overflow-x-auto whitespace-nowrap border-b px-4 py-2 text-[15px] md:w-48 md:shrink-0 md:flex-col md:items-start md:overflow-visible md:border-b-0 md:border-r md:p-4">
        {SECTIONS.map(([href, label]) => (
          <Link key={href} href={href} className="flex min-h-11 items-center hover:underline md:min-h-8">
            {label}
          </Link>
        ))}
        <span className="text-ink-muted mt-4 hidden text-xs md:block">{user.email}</span>
        <form action={signOutAction}>
          <button type="submit" className="text-xs underline">
            Sign out
          </button>
        </form>
      </nav>
      <main className="flex-1 space-y-6 p-4 md:p-6">{children}</main>
    </div>
  );
}
