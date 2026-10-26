'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SuggestFor } from '@/features/search/suggest-for';
import { isQuickPath, QUICK_HOME } from '@/lib/site';

import { HeaderIcon } from './header-icons';

/**
 * Phones only (D-116): a search icon in the header's icons (where Saved is on wider screens; Saved moves into the
 * menu). A tap grows a search bar over the whole header bar, the field focused; Enter opens /search, ×, Escape or
 * going to another page put the header back. Without JavaScript the icon is a plain link to /search. D-154: inside the
 * 7-day store it searches only 7-day pieces. D-160: suggestions while typing (Escape closes them first).
 */
export function PhoneSearch(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLAnchorElement>(null);
  const path = usePathname();
  const search = isQuickPath(path) ? `${QUICK_HOME}/search` : '/search';

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <a
        ref={button}
        href={search}
        className="site-icon md:hidden"
        aria-label="Search"
        aria-expanded={open}
        aria-controls="phone-search"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <HeaderIcon name="search" />
      </a>
      <form
        id="phone-search"
        action={search}
        role="search"
        className="phone-search md:hidden"
        data-open={open || undefined}
        inert={!open}
        aria-hidden={!open}
      >
        <HeaderIcon name="search" />
        <input ref={input} type="search" name="q" maxLength={100} placeholder={search === '/search' ? 'Parle-G? Kasuri methi? That one pickle?' : 'Search the 7-day store'} aria-label="Search" enterKeyHint="search" />
        <SuggestFor input={input} quick={search !== '/search'} />
        <button
          type="button"
          className="site-icon -mr-2.5 flex-none"
          aria-label="Close search"
          onClick={() => {
            setOpen(false);
            button.current?.focus();
          }}
        >
          <HeaderIcon name="close" />
        </button>
      </form>
    </>
  );
}
