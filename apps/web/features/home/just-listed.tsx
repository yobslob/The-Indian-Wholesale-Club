import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES } from '@repo/shared/domain';

import { ProductStrip } from '@/features/catalog/product-row';
import { TYPE_EMPTY } from '@/features/catalog/type-toggle';

import { JustListedSwitch } from './just-listed-switch';

import type { HomeData } from '@repo/db/store';

/**
 * Home's Just listed (D-062, D-113, D-136): the twelve newest of each type, one row at a time behind the Clothing ·
 * Food · Home & gifts switch. The rows are server-rendered; only the switch is a client island. Before migration
 * 20261016210000 (no per-type lists) the one mixed row shows, as before.
 */
export function JustListed({ home }: { home: HomeData }): React.JSX.Element | null {
  const byType = home.just_listed_types;
  if (!byType) {
    if (home.just_listed.length === 0) return null;
    return (
      <JustListedSwitch
        tabs={[{ type: 'clothing', label: 'Everything', href: '/clothing', panel: <ProductStrip products={home.just_listed} label="Just listed" /> }]}
      />
    );
  }
  // the first type with pieces opens (clothing, as a rule)
  const initial = PRODUCT_TYPES.find((t) => (byType[t]?.length ?? 0) > 0);
  if (!initial) return null;
  return (
    <JustListedSwitch
      initial={initial}
      tabs={PRODUCT_TYPES.map((t) => {
        const products = byType[t] ?? [];
        return {
          type: t,
          label: PRODUCT_TYPE_LABEL[t],
          href: PRODUCT_TYPE_PATH[t],
          panel:
            products.length > 0 ? (
              <ProductStrip products={products} label={`Just listed: ${PRODUCT_TYPE_LABEL[t]}`} />
            ) : (
              <p className="text-ink-muted py-10">{TYPE_EMPTY[t]}</p>
            ),
        };
      })}
    />
  );
}
