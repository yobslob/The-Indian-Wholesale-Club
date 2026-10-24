import Link from 'next/link';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { typeSwitch, typeSwitchItem } from './type-switch-style';

export { typeSwitch, typeSwitchItem } from './type-switch-style';

/** What a type with nothing on sale says (See all, Home's Just listed). */
export const TYPE_EMPTY: Record<ProductType, string> = {
  clothing: 'New pieces are on their way.',
  food: 'Food is coming soon.',
  home: 'Home & gifts are coming soon.',
};

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
