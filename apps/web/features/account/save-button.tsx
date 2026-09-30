'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveProductAction } from './actions';

/**
 * The heart beside the product name (D-051) = "Save for later" on a static product page: the session is
 * only read when clicked; signed-out visitors go to sign-in first.
 */
export function SaveButton({ productId }: { productId: string }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? 'Saved to your account' : 'Save for later'}
      title={saved ? 'Saved to your account' : 'Save for later'}
      onClick={() => {
        if (saved) return;
        startTransition(async () => {
          const result = await saveProductAction(productId);
          if (result === 'signin') router.push(`/login?next=${encodeURIComponent(pathname)}`);
          else setSaved(true);
        });
      }}
      className="border-line bg-paper hover:border-ink grid size-12 flex-none place-items-center rounded-full border disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`size-[22px] stroke-[1.8] ${saved ? 'fill-brand stroke-brand' : 'stroke-ink fill-none'}`}
      >
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
      </svg>
    </button>
  );
}
