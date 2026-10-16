import Link from 'next/link';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

/** What a type with nothing on sale says (See all, Home's Just listed). */
export const TYPE_EMPTY: Record<ProductType, string> = {
  clothing: 'New pieces are on their way.',
  food: 'Food is coming soon.',
  home: 'Home & gifts are coming soon.',
};

/** The frosted-glass segmented control (D-122), shared by See all's links and Home's Just listed switch (D-136). */
export const typeSwitch =
  'border-line/70 bg-paper/55 inline-flex max-w-full gap-1 overflow-x-auto rounded-pill border p-1 shadow-[0_6px_24px_rgba(20,17,15,0.08)] backdrop-blur-xl backdrop-saturate-150';
export const typeSwitchItem = (on: boolean): string =>
  `font-ui inline-flex min-h-10 shrink-0 items-center rounded-pill px-5 text-sm font-medium transition-colors duration-300 ${
    on ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'
  }`;

/**
 * The See all pages' switch between Clothing, Food and Home & gifts (D-122): a frosted-glass segmented control that
 * keeps the chosen state (a category belongs to one type, so it is dropped). Plain links: no JavaScript needed.
 */
export function TypeToggle({ current, state }: { current: ProductType; state?: string }): React.JSX.Element {
  return (
    <nav aria-label="Clothing, food or home & gifts" className={typeSwitch}>
      {PRODUCT_TYPES.map((t) => (
        <Link
          key={t}
          href={state ? `${PRODUCT_TYPE_PATH[t]}?state=${state}` : PRODUCT_TYPE_PATH[t]}
          aria-current={t === current ? 'page' : undefined}
          className={typeSwitchItem(t === current)}
        >
          {PRODUCT_TYPE_LABEL[t]}
        </Link>
      ))}
    </nav>
  );
}
