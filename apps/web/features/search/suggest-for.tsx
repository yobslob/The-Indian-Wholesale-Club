'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type RefObject } from 'react';

const SearchSuggest = dynamic(() => import('./search-suggest'), { ssr: false });

/**
 * Suggestions for a search box (D-160), armed on its first focus or hover: until then not a byte of them is loaded
 * (next/dynamic), so the store's first-load script budget (engineering.md PR-5) stays as it is.
 */
export function SuggestFor({ input, quick }: { input: RefObject<HTMLInputElement | null>; quick: boolean }): React.JSX.Element | null {
  const [armed, setArmed] = useState<HTMLInputElement | null>(null);
  useEffect(() => {
    const box = input.current;
    if (!box) return;
    if (document.activeElement === box) {
      setArmed(box);
      return;
    }
    const arm = (): void => setArmed(box);
    box.addEventListener('focus', arm, { once: true });
    box.addEventListener('pointerenter', arm, { once: true });
    return () => {
      box.removeEventListener('focus', arm);
      box.removeEventListener('pointerenter', arm);
    };
  }, [input]);
  return armed ? <SearchSuggest input={armed} quick={quick} /> : null;
}
