'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

import { quickFindAction, type Found } from './actions/find';
import { Chip } from './chips';

const SearchIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-4 w-4 shrink-0 fill-none stroke-current stroke-[1.6]"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m16.5 16.5 4.5 4.5" />
  </svg>
);

/**
 * Quick find (D-096): Ctrl+K (⌘K) from any admin page, or the find box / the phone's search button. Orders by number,
 * name or email, products, customers and shops; ↑ ↓ move, Enter opens, Esc closes.
 */
export function QuickFind({ compact = false }: { compact?: boolean }): React.JSX.Element {
  // Ctrl+K belongs to the wide bar's box; the phone's button only opens it by tap (both live in the page at once).
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState('');
  const [found, setFound] = useState<Found>([]);
  const [at, setAt] = useState(0);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const flat = found.flatMap((g) => g.items);

  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (words.trim().length < 2) {
      setFound([]);
      return;
    }
    const timer = setTimeout(() => {
      start(async () => {
        const result = await quickFindAction(words);
        setFound(result);
        setAt(0);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [words]);

  const close = (): void => {
    setOpen(false);
    setWords('');
    setFound([]);
  };
  const go = (href: string): void => {
    close();
    router.push(href);
  };
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAt((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAt((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && flat[at]) go(flat[at].href);
  };

  let index = -1;
  return (
    <>
      {compact ? (
        <button
          type="button"
          aria-label="Find"
          onClick={() => setOpen(true)}
          className="grid h-11 w-11 place-items-center"
        >
          <span className="[&>svg]:h-[22px] [&>svg]:w-[22px]">
            <SearchIcon />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-line bg-paper text-ink-muted font-ui flex h-[38px] min-w-0 flex-[0_1_460px] items-center gap-2.5 rounded-[10px] border px-3 text-[14px]"
        >
          <SearchIcon />
          <span className="truncate">Find an order, customer, product or vendor</span>
          <kbd className="border-line bg-canvas ml-auto rounded-[5px] border px-1.5 py-[3px] text-[11px] font-semibold">
            Ctrl K
          </kbd>
        </button>
      )}
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50"
              role="dialog"
              aria-modal="true"
              aria-label="Quick find"
            >
              <button
                type="button"
                aria-label="Close"
                tabIndex={-1}
                onClick={close}
                className="absolute inset-0 bg-[rgb(20_17_15/0.35)]"
              />
              <div className="bg-canvas absolute left-1/2 top-3 w-[calc(100%-24px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-2xl shadow-[0_24px_60px_rgb(20_17_15/0.3)] md:top-[90px]">
                <div className="border-line text-ink-muted flex h-[54px] items-center gap-2.5 border-b px-[18px]">
                  <SearchIcon />
                  <input
                    ref={inputRef}
                    value={words}
                    onChange={(e) => setWords(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Order number, name, email, product or shop"
                    aria-label="Find"
                    role="combobox"
                    aria-expanded={flat.length > 0}
                    aria-controls="quick-find-results"
                    aria-activedescendant={flat[at] ? `qf-${at}` : undefined}
                    className="font-ui text-ink min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none"
                  />
                  {pending ? <span className="text-[12px]">…</span> : null}
                </div>
                <div id="quick-find-results" role="listbox" className="max-h-[60vh] overflow-auto">
                  {found.map((g) => (
                    <div key={g.group}>
                      <h4 className="font-ui text-ink-muted px-[18px] pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em]">
                        {g.group}
                      </h4>
                      {g.items.map((item) => {
                        index += 1;
                        const i = index;
                        return (
                          <button
                            key={item.href + i}
                            id={`qf-${i}`}
                            type="button"
                            role="option"
                            aria-selected={i === at}
                            onMouseEnter={() => setAt(i)}
                            onClick={() => go(item.href)}
                            className={`font-ui flex w-full items-center gap-3 px-[18px] py-[9px] text-left text-[14px] leading-[1.3] ${i === at ? 'bg-surface' : ''}`}
                          >
                            {g.group === 'Products' ? (
                              <span
                                className="bg-land h-10 w-[30px] shrink-0 rounded-md bg-cover bg-center"
                                style={
                                  item.photo ? { backgroundImage: `url(${item.photo})` } : undefined
                                }
                              />
                            ) : null}
                            <span className="min-w-0 truncate">
                              {item.title}{' '}
                              {item.sub ? (
                                <small className="text-ink-muted">· {item.sub}</small>
                              ) : null}
                            </span>
                            {item.chip ? (
                              <span className="ml-auto">
                                <Chip tone={item.chip[1]}>{item.chip[0]}</Chip>
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {words.trim().length >= 2 && !pending && found.length === 0 ? (
                    <p className="text-ink-muted px-[18px] py-4 text-[14px]">
                      Nothing found for “{words.trim()}”.
                    </p>
                  ) : null}
                </div>
                <div className="border-line text-ink-muted font-ui hidden gap-4 border-t px-[18px] py-2.5 text-[12px] font-medium md:flex">
                  <span>↑ ↓ move</span>
                  <span>Enter open</span>
                  <span>Esc close</span>
                  <span className="ml-auto">Searches orders, customers, products, vendors</span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
