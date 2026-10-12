'use client';

import { useId, useState } from 'react';

/**
 * A section that opens and closes with a + / − button (D-051: instead of the browser's disclosure arrows). It opens
 * smoothly to its own height and the + folds into a − (D-116); closed, its content is inert, as `hidden` was.
 */
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
        className="font-ui group flex min-h-[52px] w-full items-center justify-between text-left text-sm font-semibold"
      >
        {title}
        <span
          aria-hidden="true"
          className="border-line bg-paper group-hover:border-ink relative grid size-[30px] place-items-center rounded-full border transition-colors"
        >
          <i className="bg-ink absolute h-[1.5px] w-3 rounded-full" />
          <i
            className={`bg-ink absolute h-3 w-[1.5px] rounded-full transition-transform duration-300 ease-[cubic-bezier(.65,0,.35,1)] ${open ? 'rotate-90 scale-y-0' : ''}`}
          />
        </span>
      </button>
      <div
        id={id}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-[cubic-bezier(.65,0,.35,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-4 text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
