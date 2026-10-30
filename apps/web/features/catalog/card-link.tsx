'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * A card's link to its product page (2026-10-30): read ahead when a finger or the mouse comes to it, not when it merely
 * scrolls past. Next's default read every card's page as it came on screen: a See all page asked for 24 to 480 product
 * pages nobody opened, each one built and stored by Vercel the first time (page-cache writes, D-145) and all of them
 * queued in front of the + and the bag's requests on a phone's connection.
 */
export function CardLink({
  href,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
  href: string;
}): React.JSX.Element {
  const router = useRouter();
  const warm = (): void => router.prefetch(href);
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
      {...rest}
    />
  );
}
