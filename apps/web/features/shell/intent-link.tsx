'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** How long the mouse rests on a link before its page is read ahead. */
const REST_MS = 120;

/**
 * Read a link's page ahead when the shopper means it: at once for a finger or the keyboard, and for the mouse only once
 * it rests on the link. A mouse crossing a grid of cards started a read of every card it passed: each a product page
 * built for the first time, several at once, which the free database could not keep up with (2026-11-03: product
 * pages failing after 8 s and searches giving up while it caught up). Resting also spares those pages' cache writes.
 */
export function useIntentPrefetch(href: string) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  const warm = (): void => {
    cancel();
    router.prefetch(href);
  };
  return {
    onPointerEnter: (e: React.PointerEvent): void => {
      if (e.pointerType !== 'mouse') return; // a finger reads ahead on touchstart
      cancel();
      timer.current = setTimeout(warm, REST_MS);
    },
    onPointerLeave: cancel,
    onTouchStart: warm,
    onFocus: warm,
  };
}

/**
 * A link that reads its page ahead when a finger, the mouse or the keyboard comes to it, never merely because it is on
 * screen (launch QA C-6; card-link.tsx does the same for cards). Next's viewport prefetch of the header and footer
 * links fetched Home, the See all pages and States on every page, and each prefetched page's stylesheets arrived as
 * `<link rel="preload" as="style">` hints the open page never used (Chrome's "preloaded but not used" warnings), on
 * a phone's connection, in front of the page's own requests.
 */
export function IntentLink({
  href,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, 'href' | 'prefetch'> & { href: string }): React.JSX.Element {
  const intent = useIntentPrefetch(href);
  return <Link href={href} prefetch={false} {...intent} {...rest} />;
}
