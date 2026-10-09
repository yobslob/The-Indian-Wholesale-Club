import Link from 'next/link';

import { button, secondaryButton } from './styles';

export interface Job {
  /** How many wait; null when it can't be counted yet (a missing setting). */
  n: number | null;
  what: string;
  sub?: string;
  go: string;
  href: string;
  /** Waits on someone outside (a customer, a shop): its count and button stand out. */
  urgent?: boolean;
}

/** A desk's work queue on Today (D-096): the count, the job, one button to it. Nothing waiting: faded, no button. */
export function Queue({ jobs }: { jobs: Job[] }): React.JSX.Element {
  return (
    <ul className="grid gap-2.5">
      {jobs.map((j) => {
        const zero = j.n === 0;
        return (
          <li
            key={j.what}
            className={`border-line bg-paper grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 rounded-[14px] border px-4 py-3.5 md:grid-cols-[64px_minmax(0,1fr)_auto] ${zero ? 'opacity-55' : ''}`}
          >
            <span className={`text-center text-[28px] font-bold leading-none ${j.urgent && !zero ? 'text-brand' : ''}`}>{j.n ?? '—'}</span>
            <span>
              <b className="block text-[15px] font-semibold leading-[1.3]">{j.what}</b>
              {j.sub ? <span className="text-ink-muted text-[13px] leading-[1.4]">{j.sub}</span> : null}
              {zero && !j.sub ? <span className="text-ink-muted text-[13px] md:hidden">Nothing to do</span> : null}
            </span>
            {zero ? (
              <span className="text-ink-muted hidden text-[12.5px] md:block">Nothing to do</span>
            ) : (
              <Link href={j.href} className={`${j.urgent ? button : secondaryButton} col-span-2 md:col-span-1`}>
                {j.go}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
