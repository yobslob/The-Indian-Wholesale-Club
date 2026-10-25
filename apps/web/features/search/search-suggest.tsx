'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH } from '@repo/shared/domain';
import { EMPTY_HINTS, parseHints, suggest, type SearchHints, type Suggestion } from '@repo/shared/search';

let hintsOnce: Promise<SearchHints> | null = null;

/** The hints, fetched once per tab (the CDN keeps them an hour, /api/search/hints): typing never calls the server. */
function loadHints(): Promise<SearchHints> {
  hintsOnce ??= fetch('/api/search/hints')
    .then(async (r) => (r.ok ? parseHints(await r.json()) : EMPTY_HINTS))
    .catch(() => {
      hintsOnce = null;
      return EMPTY_HINTS;
    });
  return hintsOnce;
}

const hrefOf = (s: Suggestion, form: HTMLFormElement | null): string => {
  if (s.kind === 'state') return `/states/${s.slug}`;
  if (s.kind === 'category') return `${PRODUCT_TYPE_PATH[s.type]}?category=${encodeURIComponent(s.slug)}`;
  // the box's own form, with its other fields (the 7-day filter): the search the suggestion completes
  const params = new URLSearchParams();
  if (form) for (const [k, v] of new FormData(form)) if (typeof v === 'string' && k !== 'q') params.append(k, v);
  params.set('q', s.query);
  return `${form ? new URL(form.action).pathname : '/search'}?${params.toString()}`;
};

/** The words typed stay plain and the completion is bold, as most stores show it. */
function Label({ s, typed }: { s: Suggestion; typed: string }): React.JSX.Element {
  if (s.kind !== 'search' || !s.label.startsWith(typed)) return <span>{s.label}</span>;
  return (
    <span>
      {typed}
      <b className="font-semibold">{s.label.slice(typed.length)}</b>
    </span>
  );
}

/**
 * Suggestions under a search box while typing (D-160): popular searches, states, categories and the word being typed
 * completed (packages/shared/src/search), from the hints read once. Loaded only when a box is first focused
 * (next/dynamic), so no store page carries it. The ARIA combobox pattern on the box itself: ↓ ↑ move, Enter takes the
 * one picked (or searches the words), Escape closes the list (a second Escape is the box's own). Drawn in a layer of
 * its own under the box, so the header's clipping never cuts it.
 */
export default function SearchSuggest({ input, quick }: { input: HTMLInputElement; quick: boolean }): React.JSX.Element | null {
  const router = useRouter();
  const listId = `suggest-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [hints, setHints] = useState<SearchHints>(EMPTY_HINTS);
  const [text, setText] = useState(input.value);
  const [open, setOpen] = useState(() => document.activeElement === input);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const items = useMemo(() => suggest(text, hints, { quick }), [text, hints, quick]);
  const shown = open && items.length > 0;
  const typed = text.toLowerCase().replace(/\s+/g, ' ').trimStart();

  useEffect(() => {
    let live = true;
    void loadHints().then((h) => live && setHints(h));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('autocomplete', 'off');
    return () => {
      for (const a of ['role', 'aria-autocomplete', 'aria-controls', 'aria-expanded', 'aria-activedescendant']) input.removeAttribute(a);
    };
  }, [input, listId]);

  useEffect(() => {
    input.setAttribute('aria-expanded', String(shown));
    if (shown && active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }, [input, listId, shown, active]);

  const choose = (s: Suggestion): void => {
    setOpen(false);
    setActive(-1);
    if (s.kind === 'search') {
      input.value = s.query;
      setText(s.query);
    }
    router.push(hrefOf(s, input.form));
  };

  useEffect(() => {
    const onInput = (): void => {
      setText(input.value);
      setActive(-1);
      setOpen(true);
    };
    const onFocus = (): void => setOpen(true);
    const onBlur = (): void => setOpen(false);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        setOpen(true);
        const down = e.key === 'ArrowDown';
        setActive((a) => (down ? (a + 1) % items.length : a <= 0 ? items.length - 1 : a - 1));
      } else if (e.key === 'Enter' && shown && active >= 0 && items[active]) {
        e.preventDefault();
        choose(items[active]);
      } else if (e.key === 'Escape' && shown) {
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      }
    };
    input.addEventListener('input', onInput);
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKey);
    return () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKey);
    };
  });

  // under the box, at least 320 px wide (on phones the whole width), inside the window's 16 px gutters; it follows
  // the box while the page moves
  useLayoutEffect(() => {
    if (!shown) return;
    let frame = 0;
    const place = (): void => {
      frame = 0;
      const r = input.getBoundingClientRect();
      const width = window.innerWidth < 640 ? window.innerWidth - 32 : Math.min(Math.max(r.width, 320), window.innerWidth - 32);
      setBox({ top: r.bottom + 6, left: Math.max(16, Math.min(r.left, window.innerWidth - 16 - width)), width });
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const grow = new ResizeObserver(schedule);
    grow.observe(input);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      grow.disconnect();
    };
  }, [shown, input]);

  return createPortal(
    <>
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!shown || !box}
        className="search-suggest"
        style={box ? { top: box.top, left: box.left, width: box.width } : undefined}
      >
        {items.map((s, i) => (
          <li
            key={`${s.kind}:${s.label}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className="search-suggest-item"
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(s)}
          >
            <Label s={s} typed={typed} />
            {s.kind === 'state' ? <span className="search-suggest-kind">State</span> : null}
            {s.kind === 'category' ? <span className="search-suggest-kind">{PRODUCT_TYPE_LABEL[s.type]}</span> : null}
          </li>
        ))}
      </ul>
      <span className="sr-only" role="status" aria-live="polite">
        {shown ? `${items.length} suggestion${items.length === 1 ? '' : 's'}, use the arrow keys` : ''}
      </span>
    </>,
    document.body,
  );
}
