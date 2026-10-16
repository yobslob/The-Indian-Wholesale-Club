'use client';

import { useState } from 'react';

import { browseHref, priceRanges, sortSizes, withFilter, type BrowseQuery } from './browse-query';
import styles from './filters.module.css';
import { PriceSlider } from './price-slider';

import type { BrowseMeta } from './use-browse';
import type { ProductType } from '@repo/shared/domain';

/** States shown before "Show all": the chosen one always among them. */
const FIRST_STATES = 8;

/**
 * See all's filter groups (D-136): Category, State, Price (a slider and four ready-made ranges) and Size (Pack for
 * food) as boxes that combine. Every choice is a real link to its address (new tabs, no JavaScript, crawlers); a
 * plain click applies it in place through `onChange`, without loading the page.
 */
export function FilterPanel({
  productType,
  query,
  meta,
  onChange,
}: {
  productType: ProductType;
  query: BrowseQuery;
  meta: BrowseMeta;
  onChange: (next: BrowseQuery) => void;
}): React.JSX.Element {
  const [allStates, setAllStates] = useState(false);
  const link = (change: Partial<BrowseQuery>) => {
    const next = withFilter(query, change);
    return {
      href: browseHref(productType, next),
      onClick: (e: React.MouseEvent<HTMLAnchorElement>): void => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // a new tab or window
        e.preventDefault();
        onChange(next);
      },
    };
  };

  const states = meta.regions;
  const shownStates =
    allStates || states.length <= FIRST_STATES + 2
      ? states
      : states.filter((s, i) => i < FIRST_STATES || s.slug === query.state);
  const prices = meta.prices;
  const bounds = prices ? { min: Math.floor(prices.min / 100), max: Math.ceil(prices.max / 100) } : null;
  const ranges = priceRanges(prices);
  const sizes = sortSizes(meta.sizes);
  const priced = query.min !== undefined || query.max !== undefined;

  return (
    <div className="font-ui">
      {meta.categories.length > 1 || query.category ? (
        <section className={styles.group} aria-labelledby="f-category">
          <div className={styles.head}>
            <h3 id="f-category">Category</h3>
          </div>
          <ul className={styles.list}>
            <li>
              <a {...link({ category: undefined })} className={styles.item} aria-current={!query.category}>
                <i aria-hidden="true" />
                Everything
              </a>
            </li>
            {meta.categories.map((c) => (
              <li key={c.slug}>
                <a {...link({ category: c.slug })} className={styles.item} aria-current={query.category === c.slug}>
                  <i aria-hidden="true" />
                  {c.name}
                  <span>{c.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.group} aria-labelledby="f-state">
        <div className={styles.head}>
          <h3 id="f-state">State</h3>
        </div>
        <ul className={styles.list}>
          <li>
            <a {...link({ state: undefined })} className={styles.item} aria-current={!query.state}>
              <i aria-hidden="true" />
              All states
              <span>{meta.states_total ?? meta.all_total}</span>
            </a>
          </li>
          {shownStates.map((s) => (
            <li key={s.slug}>
              <a {...link({ state: s.slug })} className={styles.item} aria-current={query.state === s.slug}>
                <i aria-hidden="true" />
                {s.name}
                <span>{s.count}</span>
              </a>
            </li>
          ))}
        </ul>
        {shownStates.length < states.length || allStates ? (
          <button type="button" className={styles.more} onClick={() => setAllStates((v) => !v)}>
            {allStates ? 'Show fewer' : `Show all ${states.length} states`}
          </button>
        ) : null}
      </section>

      {bounds && bounds.max > bounds.min ? (
        <section className={styles.group} aria-labelledby="f-price">
          <div className={styles.head}>
            <h3 id="f-price">Price</h3>
            {priced ? (
              <a {...link({ min: undefined, max: undefined })} className={styles.clear}>
                Any price
              </a>
            ) : null}
          </div>
          <PriceSlider
            bounds={bounds}
            min={query.min}
            max={query.max}
            onCommit={(min, max) => onChange(withFilter(query, { min, max }))}
          />
          <ul className={styles.list}>
            {ranges.map((r) => (
              <li key={r.label}>
                <a
                  {...link({ min: r.min, max: r.max })}
                  className={styles.item}
                  aria-current={query.min === r.min && query.max === r.max}
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sizes.length > 0 ? (
        <section className={styles.group} aria-labelledby="f-size">
          <div className={styles.head}>
            <h3 id="f-size">{productType === 'food' ? 'Pack' : 'Size'}</h3>
            {query.sizes.length > 0 ? (
              <a {...link({ sizes: [] })} className={styles.clear}>
                Clear
              </a>
            ) : null}
          </div>
          <div className={styles.boxes}>
            {sizes.map((s) => {
              const on = query.sizes.includes(s.value);
              return (
                <a
                  key={s.value}
                  {...link({ sizes: on ? query.sizes.filter((x) => x !== s.value) : [...query.sizes, s.value] })}
                  className={styles.box}
                  role="button"
                  aria-pressed={on}
                  title={`${s.count} ${s.count === 1 ? 'piece' : 'pieces'}`}
                >
                  {s.value}
                </a>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
