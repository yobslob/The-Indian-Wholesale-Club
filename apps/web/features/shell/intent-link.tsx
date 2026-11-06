'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** How long a mouse or a finger rests on a link before its page is read ahead. */
const REST_MS = 250;

/**
 * Read a link's page ahead when the shopper means it: at once for a finger or the keyboard, and for the mouse only once
 * it rests on the link. A mouse crossing a grid of cards started a read of every card it passed: each a product page
 * built for the first time, several at once, which the free database could not keep up with (2026-11-03: product
 * pages failing after 8 s and searches giving up while it caught up). Resting also spares those pages' cache writes.
 * D-189: the same for a finger. Most scrolls on a phone start on a card, and reading ahead on touchstart built and stored
 * the page of every card a thumb landed on. A tap needs no head start: the page comes straight from the CDN.
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
  const rest = (): void => {
    cancel();
    timer.current = setTimeout(warm, REST_MS);
  };
  return {
    onPointerEnter: (e: React.PointerEvent): void => {
      if (e.pointerType !== 'mouse') return; // a finger waits in onTouchStart
      rest();
    },
    onPointerLeave: cancel,
    onTouchStart: rest,
    onTouchMove: cancel,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
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
