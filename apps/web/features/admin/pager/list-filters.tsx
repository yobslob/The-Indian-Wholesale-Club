'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { input, linkButton } from '../styles';

import { StitchLoading } from './pager';

export interface ListSelect {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

/**
 * A list's search and filters (D-140, F10): the search runs on the server over every row, not just the page; a select
 * applies at once as a soft navigation (only the list changes, the scroll stays); any change goes back to page 1.
 * Hidden fields keep the tab and the page size.
 */
export function ListFilters({
  q,
  placeholder,
  selects = [],
  keep = {},
  clearHref,
}: {
  q: string;
  placeholder: string;
  selects?: ListSelect[];
  keep?: Record<string, string>;
  clearHref?: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const go = (form: HTMLFormElement): void => {
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (typeof v === 'string' && v.trim() !== '') p.set(k, v.trim());
    start(() => router.push(p.size ? `${pathname}?${p.toString()}` : pathname, { scroll: false }));
  };

  return (
    <form
      role="search"
      className="mb-1 space-y-2"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) go(e.currentTarget);
      }}
    >
      {pending ? <StitchLoading /> : null}
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="flex gap-2">
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className={`${input} flex-1`} />
        <button type="submit" className={linkButton}>
          Search
        </button>
      </div>
      {selects.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {selects.map((s) => (
            <select key={`${s.name}-${s.value}`} name={s.name} aria-label={s.label} defaultValue={s.value} className={`${input} md:w-auto md:min-w-[150px]`}>
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          {clearHref ? (
            <Link href={clearHref} scroll={false} className={`${linkButton} text-ink`}>
              Clear
            </Link>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
