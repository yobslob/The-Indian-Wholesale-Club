'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SECTIONS = [
  { href: '/account', label: 'Orders' },
  { href: '/account/saved', label: 'Saved' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/details', label: 'Your details' },
] as const;

/**
 * The profile's sections (D-089): a list on the left on desktop, pill tabs on phones; each section has its own address,
 * so links and Back work. The current one is marked for screen readers too.
 */
export function ProfileNav({ variant }: { variant: 'side' | 'tabs' }): React.JSX.Element {
  const path = usePathname();
  const current = (href: string): boolean => (href === '/account' ? path === '/account' : path.startsWith(href));
  if (variant === 'side') {
    return (
      <nav aria-label="Account" className="font-ui grid gap-1">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={current(s.href) ? 'page' : undefined}
            className="aria-[current=page]:bg-surface flex min-h-11 items-center rounded-xl px-3.5 text-[15px] font-medium aria-[current=page]:font-semibold"
          >
            {s.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Account" className="no-scrollbar font-ui -mx-[var(--gut)] mb-[18px] flex gap-2 overflow-x-auto px-[var(--gut)]">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={current(s.href) ? 'page' : undefined}
          className="border-line bg-paper aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper inline-flex min-h-11 flex-none items-center rounded-pill border px-[18px] text-sm font-medium"
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
