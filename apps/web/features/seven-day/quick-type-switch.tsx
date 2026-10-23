import Link from 'next/link';

import { PRODUCT_TYPE_LABEL, type ProductType } from '@repo/shared/domain';

import { typeSwitch, typeSwitchItem } from '@/features/catalog/type-toggle';
import { QUICK_HOME } from '@/lib/site';

import { quickHref } from './links';

/**
 * D-154: the 7-day store's switch on its See all pages, the same frosted-glass control as the IWC store's Clothing ·
 * Food · Home & gifts (D-122): Everything (the 7-day front page), then each type it has pieces of. Plain links.
 */
export function QuickTypeSwitch({ current, types }: { current: ProductType; types: ProductType[] }): React.JSX.Element {
  return (
    <nav aria-label="The 7-day store's food or home & gifts" className={typeSwitch}>
      <Link href={QUICK_HOME} className={typeSwitchItem(false)}>
        Everything
      </Link>
      {types.map((t) => (
        <Link key={t} href={quickHref(t)} aria-current={t === current ? 'page' : undefined} className={typeSwitchItem(t === current)}>
          {PRODUCT_TYPE_LABEL[t]}
        </Link>
      ))}
    </nav>
  );
}
