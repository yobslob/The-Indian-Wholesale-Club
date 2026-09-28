/** Plain, dense admin building blocks (design.md §Admin look). */

export const input = 'min-h-11 w-full rounded-sm border border-line bg-canvas px-2';
export const button = 'min-h-11 rounded-sm bg-brand px-3 text-canvas disabled:opacity-50';
export const linkButton = 'min-h-11 underline';

export function PageTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h1 className="text-lg font-semibold">{children}</h1>;
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
              <th key={h} className="px-2 py-2 font-normal">
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
    <label className="block">
      <span className="text-ink-muted">{label}</span>
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
