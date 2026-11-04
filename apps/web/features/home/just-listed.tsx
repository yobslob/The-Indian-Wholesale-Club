import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES } from '@repo/shared/domain';

import { seeAllPill, sectionHeading } from '@/features/catalog/product-row';
import { IntentLink } from '@/features/shell/intent-link';

import { LazyStrip } from './lazy-sections';

import type { HomeData } from '@repo/db/store';

/** A type's row shows once it has this many pieces: a near-empty row in the middle of Home reads as a shop closing. */
const MIN_ROW = 4;

/**
 * Home's Just listed (D-062, D-113; D-140 replaces D-136's switch): one heading, then a row for Clothing and for Home &
 * gifts (D-187: the food rows above cover Food), the twelve newest of each, every row with its own See all. A type with
 * fewer than four pieces is left out. The headings and See all are server-rendered; each row's cards are drawn as it
 * comes near (launch QA C-2, lazy-sections.tsx).
 */
export function JustListed({ home }: { home: HomeData }): React.JSX.Element | null {
  const rows = PRODUCT_TYPES.map((t) => ({ type: t, products: home.just_listed_types[t] ?? [] })).filter(
    (r) => r.products.length >= MIN_ROW,
  );
  if (rows.length === 0) return null;

  return (
    <section id="just-listed" aria-labelledby="just-listed-h" className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
      <h2 id="just-listed-h" className={`${sectionHeading} mb-[clamp(12px,1.4vw,20px)]`} data-reveal="">
        Just listed
      </h2>
      {/* One column that may shrink below its content (minmax(0,1fr) + min-w-0): a plain `grid` sizes its column to the
          rows' full width, so each row grew past the screen, could not scroll and pushed See all off the page. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-[clamp(20px,2.4vw,32px)]">
          {rows.map(({ type, products }) => (
            <section key={type} aria-labelledby={`just-listed-${type}`} className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h3 id={`just-listed-${type}`} className="font-heading text-[clamp(18px,1.5vw,22px)] font-medium tracking-[-0.01em]">
                  {PRODUCT_TYPE_LABEL[type]}
                </h3>
                <IntentLink href={PRODUCT_TYPE_PATH[type]} className={seeAllPill}>
                  See all<span className="sr-only"> {PRODUCT_TYPE_LABEL[type]}</span>
                  <span aria-hidden="true" className="-mr-1 transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </IntentLink>
              </div>
              <LazyStrip products={products} label={`Just listed: ${PRODUCT_TYPE_LABEL[type]}`} />
            </section>
          ))}
      </div>
    </section>
  );
}
