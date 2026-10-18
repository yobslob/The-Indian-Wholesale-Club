'use client';

import Link, { useLinkStatus } from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useTransition } from 'react';

import { input } from '../styles';

import { pageCount, pageHref, pageWindow, PAGE_SIZES, rangeLabel, sizeCookie } from './paging';

/**
 * One pager for every admin list (D-140, F10): "1–50 of 3,412", page numbers with gaps, Previous / Next, Go to page
 * and the page size (remembered per list in a cookie). Paging is a soft navigation that keeps the scroll, so only the
 * list changes; a thin stitch runs along the top while the next page loads. `keys` turns ← / → into Previous / Next
 * when no field has focus (give it to one pager per page).
 */
export function Pager({
  list,
  path,
  params,
  page,
  size,
  total,
  param = 'page',
  keys = false,
}: {
  /** The list's name, for its remembered page size. */
  list: string;
  path: string;
  /** The address's other parameters (filters, search, tab), kept on every link. */
  params: Record<string, string>;
  page: number;
  size: number;
  total: number;
  /** The page parameter, when a screen has two lists. */
  param?: string;
  keys?: boolean;
}): React.JSX.Element | null {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toId = useId();
  const pages = pageCount(total, size);
  const at = Math.min(page, pages);
  const href = (n: number): string => pageHref(path, params, n, param);
  const go = (url: string): void => start(() => router.push(url, { scroll: false }));

  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      if (e.key === 'ArrowLeft' && at > 1) go(href(at - 1));
      else if (e.key === 'ArrowRight' && at < pages) go(href(at + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // an empty list says so itself
  if (total === 0) return null;
  const link = 'font-ui inline-grid h-11 min-w-11 md:h-9 md:min-w-9 place-items-center rounded-[9px] px-2 text-[13px] font-semibold';
  return (
    <nav aria-label="Pages" className="text-ink-muted font-ui my-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
      {pending ? <StitchLoading /> : null}
      <span className="text-ink font-semibold" aria-live="polite">
        {rangeLabel(at, size, total)}
      </span>
      {pages > 1 ? (
        <span className="flex flex-wrap items-center gap-1">
          {at > 1 ? (
            <PageLink href={href(at - 1)} className={`${link} hover:bg-paper`} label="Previous page">
              ← Previous
            </PageLink>
          ) : null}
          {pageWindow(at, pages).map((n, i) =>
            n === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1">
                …
              </span>
            ) : n === at ? (
              <span key={n} aria-current="page" className={`${link} bg-ink text-paper`}>
                {n}
              </span>
            ) : (
              <PageLink key={n} href={href(n)} className={`${link} text-ink hover:bg-paper`} label={`Page ${n}`}>
                {n}
              </PageLink>
            ),
          )}
          {at < pages ? (
            <PageLink href={href(at + 1)} className={`${link} hover:bg-paper`} label="Next page">
              Next →
            </PageLink>
          ) : null}
        </span>
      ) : null}
      {pages > 5 ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(new FormData(e.currentTarget).get('to'));
            if (Number.isInteger(n) && n >= 1) go(href(Math.min(n, pages)));
          }}
        >
          <label htmlFor={toId} className="whitespace-nowrap">Go to page</label>
          <input id={toId} name="to" type="number" min={1} max={pages} inputMode="numeric" className={`${input} w-20`} />
        </form>
      ) : null}
      {total > PAGE_SIZES[0] ? (
        <label className="ml-auto flex items-center gap-1.5 whitespace-nowrap">
          Show
          <select
            value={size}
            className={`${input} w-auto`}
            onChange={(e) => {
              const n = e.currentTarget.value;
              document.cookie = `${sizeCookie(list)}=${n}; path=/admin; max-age=31536000; samesite=lax`;
              go(pageHref(path, { ...params, size: n }, 1, param));
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          a page
        </label>
      ) : null}
    </nav>
  );
}

function PageLink({ href, className, label, children }: { href: string; className: string; label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Link href={href} scroll={false} className={className} aria-label={label}>
      {children}
      <Pending />
    </Link>
  );
}

function Pending(): React.JSX.Element | null {
  const { pending } = useLinkStatus();
  return pending ? <StitchLoading /> : null;
}

/** The brand's running stitch along the top of the window while a page loads (D-140, design plan §3). */
export function StitchLoading(): React.JSX.Element {
  return <span role="progressbar" aria-label="Loading" className="stitch-loading" />;
}
