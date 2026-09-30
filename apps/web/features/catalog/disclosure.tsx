'use client';

import { useId, useState } from 'react';

/** A section that opens and closes with a + / − button (D-051: instead of the browser's disclosure arrows). */
export function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-line border-t">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="font-ui flex min-h-[52px] w-full items-center justify-between text-left text-sm font-semibold"
      >
        {title}
        <span
          aria-hidden="true"
          className="border-line bg-paper grid size-[30px] place-items-center rounded-full border text-lg font-medium leading-none"
        >
          {open ? '−' : '+'}
        </span>
      </button>
      <div id={id} hidden={!open} className="pb-4 text-sm">
        {children}
      </div>
    </div>
  );
}
