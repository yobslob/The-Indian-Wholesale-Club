import Link from 'next/link';

/**
 * Plain, dense admin building blocks (design.md §Admin look): the approved mockup's admin screen (D-050), on the
 * same tokens as the store, with no brand decoration. Ink buttons, paper fields, Montserrat for labels and controls.
 */

export const input = 'min-h-11 w-full rounded-md border border-line bg-paper px-3 text-ink';
export const button = 'font-ui min-h-11 rounded-md bg-ink px-4 text-[15px] text-canvas disabled:opacity-50';
export const secondaryButton = 'font-ui min-h-11 rounded-md border border-line bg-paper px-4 text-[15px] text-ink';
export const linkButton = 'min-h-11 underline';

export function PageTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h1 className="font-heading text-[28px] font-medium leading-tight tracking-[-0.02em]">{children}</h1>;
}

/** Small uppercase label above a group, like the store's "OPEN NOW". */
export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }): React.JSX.Element {
  return (
    <h2 id={id} className="font-ui text-ink-muted text-[13px] font-semibold uppercase tracking-[0.12em]">
      {children}
    </h2>
  );
}

/** Links that switch between views of one job (New / Drafts / Live / Paused). */
export function Tabs({
  items,
  current,
}: {
  items: { href: string; label: React.ReactNode; key: string }[];
  current: string;
}): React.JSX.Element {
  return (
    <nav aria-label="Views" className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? 'page' : undefined}
          className={`font-ui flex min-h-11 shrink-0 items-center rounded-md px-3.5 text-[15px] ${
            t.key === current ? 'bg-ink text-canvas' : 'text-ink hover:bg-surface'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Table({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-line text-ink-muted border-b">
            {head.map((h) => (
              <th key={h} className="font-ui px-2 py-2 text-[13px] font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="block space-y-1.5">
      <span className="font-ui text-ink block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-ink-muted">{children}</p>;
}

const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
export function utc(iso: string | null | undefined): string {
  return iso ? `${dateTimeFmt.format(new Date(iso))} UTC` : '—';
}

export function rupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
}
