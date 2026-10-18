'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { useSaved } from './saved-store';

/**
 * The heart (D-051), since D-140 (plan F6) on every card's photo too: it fills the moment it is pressed (a short pop,
 * CSS only), is never disabled, and the database follows a moment later (saved-store.ts); a refusal puts it back with
 * "Couldn't save". Signed out, the piece is saved on this device and joins the account after sign-in; the first such
 * save says so once. Static pages stay static: the state loads in the browser, once per page.
 */
export function SaveButton({
  productId,
  small = false,
}: {
  productId: string;
  /** On a card's photo. */
  small?: boolean;
}): React.JSX.Element {
  const pathname = usePathname();
  const saved = useSaved((s) => s.ids.has(productId));
  const failed = useSaved((s) => s.failed === productId);
  const hint = useSaved((s) => s.deviceHint && s.userId === null && s.ids.has(productId));
  const load = useSaved((s) => s.load);
  const toggle = useSaved((s) => s.toggle);
  useEffect(() => load(), [load]);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? 'Saved. Remove from saved' : 'Save for later'}
        title={saved ? 'Saved. Remove from saved' : 'Save for later'}
        onPointerDown={(e) => {
          // the same frame as the press (rule 0.1); a keyboard press arrives as a click with no pointer
          if (e.button !== 0) return;
          e.preventDefault();
          toggle(productId);
        }}
        onClick={(e) => {
          if (e.detail === 0) toggle(productId);
        }}
        className={`heart border-line bg-paper hover:border-ink grid ${small ? 'size-11' : 'size-12'} flex-none place-items-center rounded-full border`}
        data-on={saved || undefined}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-[22px] stroke-[1.8] ${saved ? 'fill-brand stroke-brand' : 'stroke-ink fill-none'}`}>
          <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
        </svg>
      </button>
      {failed ? (
        <span role="alert" className="font-ui bg-ink text-paper absolute right-0 top-full z-[4] mt-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px]">
          Couldn&apos;t save
        </span>
      ) : hint ? (
        <span role="status" className="font-ui bg-paper border-line absolute right-0 top-full z-[4] mt-1 w-[200px] rounded-[10px] border px-2.5 py-1.5 text-[12px] shadow-sm">
          Saved on this device.{' '}
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="underline">
            Sign in
          </Link>{' '}
          to keep them on every device.
        </span>
      ) : null}
    </span>
  );
}
