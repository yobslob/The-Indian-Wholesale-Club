'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * The admin's dialog (D-096): a dimmed page and a box in the middle; Esc or a tap outside closes it, focus moves in
 * and returns to what opened it. Confirm boxes, the bulk ship form and the order's "More" actions use it.
 */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('input, select, textarea, button[data-autofocus]');
    (first ?? box.current)?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[rgb(20_17_15/0.35)]" />
      <div
        ref={box}
        tabIndex={-1}
        className={`bg-canvas font-ui text-ink absolute left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[18px] p-[22px] shadow-[0_24px_60px_rgb(20_17_15/0.25)] outline-none ${
          wide ? 'max-w-[640px]' : 'max-w-[440px]'
        }`}
      >
        <h3 className="font-heading mb-2 text-[20px] font-semibold leading-[1.2]">{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** What the customer will be emailed, shown inside a confirm box before anything is sent (D-096). */
export function MailPreview({ subject, children }: { subject: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-line bg-paper text-ink-muted mb-4 rounded-[10px] border p-3 text-[13px] leading-[1.45]">
      <b className="text-ink mb-1 block">The customer gets: “{subject}”</b>
      {children}
    </div>
  );
}
