'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { HeaderIcon } from './header-icons';

/**
 * The phone menu (D-079): a side panel from the right over the page, in and out with the same motion, icons only. A real
 * button (keyboard and screen readers), Escape and a tap on the dimmed page close it, and it closes when the page
 * changes. The panel's links are server-rendered children; this only opens and closes it.
 */
export function SiteMenu({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="site-icon site-burger"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="site-panel"
        onClick={() => setOpen(true)}
      >
        <HeaderIcon name="menu" />
      </button>
      <div className="site-scrim" data-open={open || undefined} aria-hidden="true" onClick={() => setOpen(false)} />
      <aside id="site-panel" className="site-panel font-ui" data-open={open || undefined} aria-label="Menu">
        <button
          ref={close}
          type="button"
          className="site-icon site-panel-close"
          aria-label="Close menu"
          onClick={() => {
            setOpen(false);
            button.current?.focus();
          }}
        >
          <HeaderIcon name="close" />
        </button>
        {children}
      </aside>
    </>
  );
}
