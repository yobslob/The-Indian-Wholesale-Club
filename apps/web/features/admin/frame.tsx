'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ZONES, deskOrder, type Desk } from '@repo/shared/admin';

import { LiveChannel, LiveDot } from './live-feed';
import { QuickFind } from './quick-find';

import type { WaitingCounts } from '@repo/db/admin';

type Item = { href: string; label: string; count?: number; hint?: string; soft?: boolean };

/** The sidebar grouped by job, with live counts of what waits (D-096). */
function groups(c: WaitingCounts): [string, Item[]][] {
  return [
    [
      'Daily',
      [
        { href: '/admin', label: 'Today' },
        { href: '/admin/orders', label: 'Orders', count: c.ordersToShip, hint: 'Arrived · to ship' },
        { href: '/admin/cycles', label: 'Cycle', count: c.pickupsToDo, hint: 'Pickups to do' },
        { href: '/admin/listings', label: 'Listings', count: c.drafts, hint: 'Drafts' },
        { href: '/admin/payouts', label: 'Payouts', count: c.shopsOwed, hint: 'Shops owed' },
      ],
    ],
    [
      'Catalog',
      [
        { href: '/admin/catalog', label: 'Products' },
        { href: '/admin/regions', label: 'Regions' },
        { href: '/admin/reviews', label: 'Reviews', count: c.reviews, hint: 'To approve', soft: true },
        { href: '/admin/promotions', label: 'Promotions' },
      ],
    ],
    [
      'People',
      [
        { href: '/admin/customers', label: 'Customers' },
        { href: '/admin/vendors', label: 'Vendors' },
        { href: '/admin/returns', label: 'Returns', count: c.returns, hint: 'Requested', soft: true },
      ],
    ],
    [
      '',
      [
        { href: '/admin/insights', label: 'Insights' },
        { href: '/admin/settings', label: 'Settings' },
      ],
    ],
  ];
}

const isCurrent = (pathname: string, href: string): boolean =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

/** The desk's clock in both zones (D-096), ticking each half minute. */
function Clock({ desk }: { desk: Desk | null }): React.JSX.Element {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const [own, other] = deskOrder(desk).map((d) => ZONES[d]) as [(typeof ZONES)[Desk], (typeof ZONES)[Desk]];
  const fmt = (tz: string, weekday: boolean): string =>
    now
      ? new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', ...(weekday ? { weekday: 'short' } : {}) }).format(now)
      : '';
  return (
    <div className="font-ui min-w-[150px] text-right text-[13px] font-medium leading-[1.3]" aria-label="Clocks">
      {now ? `${fmt(own.tz, true)} · ${own.place}` : ' '}
      <small className="text-ink-muted block text-[13px] font-normal">{now ? `${fmt(other.tz, false)} · ${other.place}` : ' '}</small>
    </div>
  );
}

/**
 * The admin's frame (D-096): a sidebar grouped by job with counts, and a top bar with quick find, the desk's clock in
 * both zones and the live dot. On phones: a top bar with the menu, the page's title and find; the menu slides in.
 */
export function AdminFrame({
  counts,
  email,
  desk,
  signOut,
  children,
}: {
  counts: WaitingCounts;
  email: string;
  desk: Desk | null;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  const nav = groups(counts);
  const current = nav.flatMap(([, items]) => items).find((i) => isCurrent(pathname, i.href));

  const side = (
    <>
      <div className="font-heading flex items-center gap-2 px-2 pb-4 pt-1 text-[15px] font-semibold">
        IWC
        <i className="border-line font-ui text-ink-muted rounded-md border px-1.5 py-[3px] text-[10px] font-semibold not-italic uppercase tracking-[0.12em]">
          admin
        </i>
      </div>
      <nav aria-label="Admin">
        {nav.map(([group, items]) => (
          <div key={group || 'more'}>
            {group ? (
              <p className="font-ui text-ink-muted mb-1 mt-3 px-2 text-[10.5px] font-bold uppercase tracking-[0.14em]">{group}</p>
            ) : (
              <div className="h-2.5" />
            )}
            {items.map((item) => {
              const on = isCurrent(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  title={item.count ? item.hint : undefined}
                  className={`font-ui flex h-10 items-center justify-between rounded-[9px] px-2.5 text-[14px] md:h-9 ${
                    on ? 'bg-paper font-bold shadow-[inset_3px_0_0_theme(colors.brand),0_0_0_1px_theme(colors.line)]' : 'font-medium hover:bg-paper/50'
                  }`}
                >
                  {item.label}
                  {item.count ? (
                    <b
                      className={`h-5 min-w-[22px] rounded-full px-1.5 text-center text-[11px] font-bold leading-5 ${
                        item.soft ? 'bg-line text-ink' : 'bg-ink text-paper'
                      }`}
                    >
                      <span className="sr-only">{item.hint}: </span>
                      {item.count}
                    </b>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-line text-ink-muted mt-[18px] border-t p-2.5 text-[12px] leading-normal">
        <span className="break-all">{email}</span>
        {desk ? ` · ${desk === 'india' ? 'India' : 'US'} desk` : ''}
        <form action={signOut}>
          <button type="submit" className="text-ink underline">
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <LiveChannel />
      <div className="md:grid md:min-h-screen md:grid-cols-[228px_minmax(0,1fr)]">
        <aside className="border-line bg-surface sticky top-0 hidden h-screen overflow-auto border-r px-3 py-4 md:block print:hidden">{side}</aside>
        {menu ? (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close the menu" onClick={() => setMenu(false)} className="absolute inset-0 bg-[rgb(20_17_15/0.35)]" />
            <aside className="bg-surface absolute inset-y-0 left-0 w-[260px] overflow-auto px-3 py-4 shadow-xl">{side}</aside>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <header className="border-line bg-canvas sticky top-0 z-30 hidden h-14 items-center gap-3.5 border-b px-6 md:flex print:hidden">
            <QuickFind />
            <div className="ml-auto">
              <Clock desk={desk} />
            </div>
            <LiveDot />
            <span className="bg-ink text-paper font-ui grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold" aria-hidden="true">
              {email.slice(0, 1).toUpperCase()}
            </span>
          </header>
          <header className="border-line bg-canvas sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-2 md:hidden print:hidden">
            <button type="button" aria-label="Menu" onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px] fill-none stroke-current stroke-[1.6]">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <p className="font-heading flex-1 truncate text-[18px] font-semibold">{current?.label ?? 'Admin'}</p>
            <QuickFind compact />
          </header>
          <main className="px-3.5 pb-24 pt-3.5 md:px-7 md:pb-10 md:pt-[22px]">{children}</main>
        </div>
      </div>
    </>
  );
}
