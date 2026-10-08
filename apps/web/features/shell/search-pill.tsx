'use client';

import { useRef } from 'react';

import { HeaderIcon } from './header-icons';

/**
 * The header's Search (D-079): the word itself turns into a search pill on hover or focus and back when the pointer
 * leaves, unless something was typed. Enter opens /search. The look is CSS (app/globals.css, .site-search); the only
 * script lets the pill close on mouse-out while it still has focus.
 */
export function SearchPill(): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      action="/search"
      role="search"
      className="site-search"
      onMouseLeave={() => {
        if (input.current && !input.current.value) input.current.blur();
      }}
    >
      <span className="site-search-word" aria-hidden="true">
        Search
      </span>
      <HeaderIcon name="search" />
      <input ref={input} type="search" name="q" placeholder="Search" aria-label="Search" />
    </form>
  );
}
