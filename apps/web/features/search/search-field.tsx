'use client';

import { useEffect, useRef } from 'react';

import { cleanSearch } from '@repo/shared/search';

import { HeaderIcon } from '@/features/shell/header-icons';

import { SuggestFor } from './suggest-for';

/**
 * The search page's box (D-085) with the suggestions (D-160); on phones a round search icon inside it. The words go
 * out as the search's one address spells them (lower case, single spaces: search-url.ts), so a phone's capital
 * first letter is not a second address and a redirect.
 */
export function SearchField({ defaultValue, placeholder, quick }: { defaultValue: string; placeholder: string; quick: boolean }): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const tidy = (): void => {
      if (input.current) input.current.value = cleanSearch(input.current.value).toLowerCase(); // as normalSearch (search-url.ts)
    };
    form.addEventListener('submit', tidy);
    return () => form.removeEventListener('submit', tidy);
  }, []);
  return (
    <div className="relative flex flex-1">
      <input
        ref={input}
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={100}
        enterKeyHint="search"
        className="border-line bg-paper focus:border-ink min-h-12 flex-1 rounded-pill border px-4 pr-[52px] text-[15px] outline-none md:pr-4"
      />
      <button type="submit" aria-label="Search" className="bg-brand text-on-brand absolute right-1 top-1 grid size-10 place-items-center rounded-full md:hidden">
        <HeaderIcon name="search" />
      </button>
      <SuggestFor input={input} quick={quick} />
    </div>
  );
}
