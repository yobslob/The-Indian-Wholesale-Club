'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const warm = (): void => router.prefetch(href);
  return <Link href={href} prefetch={false} onPointerEnter={warm} onTouchStart={warm} onFocus={warm} {...rest} />;
}
