import Link from 'next/link';

import { deskTime, type Desk } from '@repo/shared/admin';

import { adminAccess } from './guard';
import { panel } from './styles';

/**
 * The admin's building blocks in the approved look (D-096, design/pages/admin): plain and dense, the store's tokens,
 * Syne titles and Karla for everything else, paper panels, ink primary buttons, plain chips (chips.tsx).
 */

export { button, dangerButton, input, linkButton, panel, secondaryButton } from './styles';

export function PageTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h1 className="font-heading text-[22px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[26px]">{children}</h1>;
}

/**
 * A page's head: its title (codes such as orders and cycles in Karla, D-096), a line under it, and its actions on the
 * right. `back` adds the small link above the title.
 */
export function PageHead({
  title,
  code,
  sub,
  actions,
  back,
}: {
  title: React.ReactNode;
  code?: boolean;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}): React.JSX.Element {
  return (
    <div className="mb-[18px]">
      {back ? (
        <Link href={back.href} className="font-ui text-ink-muted mb-2 inline-flex items-center gap-1 text-[13px] font-medium">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.6]">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          {code ? (
            <h1 className="font-ui break-all text-[20px] font-bold leading-[1.1] tracking-[0.01em] md:text-[24px]">{title}</h1>
          ) : (
            <PageTitle>{title}</PageTitle>
          )}
          {sub ? <div className="font-ui text-ink-muted mt-1.5 flex flex-wrap items-center gap-1.5 text-[14px]">{sub}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 md:ml-auto">{actions}</div> : null}
      </div>
    </div>
  );
}

/** A paper panel with an optional Syne heading and a small note at its right. */
export function Panel({
  title,
  note,
  children,
  className = '',
  id,
}: {
  title?: React.ReactNode;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}): React.JSX.Element {
  return (
    <section id={id} className={`${panel} ${className}`}>
      {title ? (
        <h2 className="font-heading mb-3 flex items-center gap-2 text-[15px] font-semibold leading-tight">
          {title}
          {note ? <small className="font-ui text-ink-muted ml-auto text-[12px] font-medium">{note}</small> : null}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** Small uppercase label above a group (the sidebar's groups, Today's desks). */
export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }): React.JSX.Element {
  return (
    <h2 id={id} className="font-ui text-ink-muted text-[10.5px] font-bold uppercase tracking-[0.14em]">
      {children}
    </h2>
  );
}

/** Links that switch between views of one job (New / Add many / Drafts / Live / Paused). */
export function Tabs({
  items,
  current,
}: {
  items: { href: string; label: React.ReactNode; key: string; count?: number }[];
  current: string;
}): React.JSX.Element {
  return (
    <nav aria-label="Views" className="border-line mb-4 flex gap-1 overflow-x-auto border-b">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? 'page' : undefined}
          className={`font-ui -mb-px flex min-h-11 shrink-0 items-center gap-1 border-b-2 px-3.5 text-[14px] font-semibold ${
            t.key === current ? 'border-brand text-ink' : 'text-ink-muted hover:text-ink border-transparent'
          }`}
        >
          {t.label}
          {t.count !== undefined ? <b className="text-ink-muted font-bold">{t.count}</b> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Filter chips with counts (Orders, Cycle pickups): links, the current one in ink. */
export function FilterChips({ items }: { items: { href: string; label: string; count?: number; on: boolean }[] }): React.JSX.Element {
  return (
    <nav aria-label="Filter" className="-mx-3.5 mb-3 flex gap-1.5 overflow-x-auto px-3.5 md:mx-0 md:flex-wrap md:px-0">
      {items.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          aria-current={c.on ? 'true' : undefined}
          className={`font-ui inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium md:h-8 ${
            c.on ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:border-ink-muted'
          }`}
        >
          {c.label}
          {c.count !== undefined ? <b className={c.on ? 'text-paper/70' : 'text-ink-muted'}>{c.count}</b> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Table({ head, children }: { head: (string | { label: string; right?: boolean })[]; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="font-ui w-full border-collapse text-left text-[14px] leading-[1.3]">
        <thead>
          <tr>
            {head.map((h, i) => {
              const { label, right } = typeof h === 'string' ? { label: h, right: false } : h;
              return (
                <th
                  key={`${label}-${i}`}
                  className={`border-line text-ink-muted whitespace-nowrap border-b px-2.5 pb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] ${right ? 'text-right' : ''}`}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&>tr:hover>td]:bg-paper/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, className = '' }: { children?: React.ReactNode; className?: string }): React.JSX.Element {
  return <td className={`border-line border-b p-2.5 align-middle ${className}`}>{children}</td>;
}

/** A second, muted line inside a table cell. */
export function Sub({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <small className="text-ink-muted mt-0.5 block text-[12px]">{children}</small>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block space-y-[5px]">
      <span className="font-ui text-ink-muted block text-[12px] font-semibold leading-tight">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-ink-muted">{children}</p>;
}

/** The signed-in admin's desk (D-007), from the request's one access check. */
export async function myDesk(): Promise<Desk | null> {
  const access = await adminAccess();
  return access.state === 'admin' ? access.desk : null;
}

/** A time in the admin's desk zone with the other zone under it (D-096). Server only: it reads the desk. */
export async function When({ iso, inline = false }: { iso: string | null | undefined; inline?: boolean }): Promise<React.JSX.Element> {
  if (!iso) return <>—</>;
  const t = deskTime(iso, await myDesk());
  return inline ? (
    <span>
      {t.main} <span className="text-ink-muted">({t.other})</span>
    </span>
  ) : (
    <span>
      {t.main}
      <Sub>{t.other}</Sub>
    </span>
  );
}

export function rupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
}
