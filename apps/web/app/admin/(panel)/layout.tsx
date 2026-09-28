import Link from 'next/link';

import { signOutAction } from '@/features/account/actions';
import { requireAdminPage } from '@/features/admin/guard';

/** Every admin page passes this server check first (admin.md §Access model). */
const SECTIONS = [
  ['/admin', 'Today'],
  ['/admin/orders', 'Orders'],
  ['/admin/cycles', 'Cycles'],
  ['/admin/payouts', 'Payouts'],
  ['/admin/vendors', 'Vendors'],
  ['/admin/listings', 'Listings'],
  ['/admin/catalog', 'Catalog'],
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
      <nav className="border-line flex flex-wrap gap-x-4 gap-y-1 border-b p-4 md:w-48 md:flex-col md:border-b-0 md:border-r">
        {SECTIONS.map(([href, label]) => (
          <Link key={href} href={href} className="min-h-8 hover:underline">
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
