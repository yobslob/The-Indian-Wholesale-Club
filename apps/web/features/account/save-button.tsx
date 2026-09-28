'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveProductAction } from './actions';

/** "Save for later" on a static product page: the session is only read when clicked. */
export function SaveButton({ productId }: { productId: string }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || saved}
      onClick={() =>
        startTransition(async () => {
          const result = await saveProductAction(productId);
          if (result === 'signin') router.push(`/login?next=${encodeURIComponent(pathname)}`);
          else setSaved(true);
        })
      }
      className="min-h-11 text-sm underline disabled:no-underline"
    >
      {saved ? 'Saved to your account' : 'Save for later'}
    </button>
  );
}
