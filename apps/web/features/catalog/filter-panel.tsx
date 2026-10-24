'use client';

import { useState } from 'react';

import { browseHref, priceRanges, sizeGroups, withFilter, WHO, WHO_LABEL, type BrowseQuery } from './browse-query';
import styles from './filters.module.css';
import { PriceSlider } from './price-slider';

import type { BrowseMeta } from './use-browse';
import type { ProductType } from '@repo/shared/domain';

/** States shown before "Show all": the chosen one always among them. */
const FIRST_STATES = 8;

/**
 * See all's filter groups (D-136): Delivery (in 7 days, D-154, while there are 7-day pieces), For (clothing: Women ·
 * Men, D-140), Category, State, Price (a slider and four
 * ready-made ranges) and Size (Pack for food) as boxes that combine, grouped by kind (D-140). Every choice is a real link to its address (new tabs, no JavaScript, crawlers); a
 * plain click applies it in place through `onChange`, without loading the page.
 */
export function FilterPanel({
  productType,
  query,
  meta,
  quickDays = null,
  onChange,
  states = true,
}: {
  productType: ProductType;
  query: BrowseQuery;
  meta: BrowseMeta;
  /** D-154: the 7-day days (Settings); null while 7-day delivery is off. */
  quickDays?: number | null;
  onChange: (next: BrowseQuery) => void;
  /** D-157: false on a state's own page, where the state is fixed. */
  states?: boolean;
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

  const regions = meta.regions;
  const shownStates =
    allStates || regions.length <= FIRST_STATES + 2
      ? regions
      : regions.filter((s, i) => i < FIRST_STATES || s.slug === query.state);
  const prices = meta.prices;
  const bounds = prices ? { min: Math.floor(prices.min / 100), max: Math.ceil(prices.max / 100) } : null;
  const ranges = priceRanges(prices);
  const groups = sizeGroups(meta.sizes);
  const sizeCount = meta.sizes.length;
  const priced = query.min !== undefined || query.max !== undefined;

  return (
    <div className="font-ui">
      {quickDays && (meta.quick_total > 0 || query.quick) ? (
        <section className={styles.group} aria-labelledby="f-delivery">
          <div className={styles.head}>
            <h3 id="f-delivery">Delivery</h3>
          </div>
          <ul className={styles.list}>
            <li>
              <a {...link({ quick: undefined })} className={styles.item} aria-current={!query.quick}>
                <i aria-hidden="true" />
                Any
              </a>
            </li>
            <li>
              <a {...link({ quick: true })} className={styles.item} aria-current={Boolean(query.quick)}>
                <i aria-hidden="true" />
                In {quickDays} days
                <span>{meta.quick_total}</span>
              </a>
            </li>
          </ul>
        </section>
      ) : null}
      {productType === 'clothing' && meta.wears ? (
        <section className={styles.group} aria-labelledby="f-for">
          <div className={styles.head}>
            <h3 id="f-for">For</h3>
          </div>
          <ul className={styles.list}>
            <li>
              <a {...link({ who: undefined })} className={styles.item} aria-current={!query.who}>
                <i aria-hidden="true" />
                Everyone
              </a>
            </li>
            {WHO.map((w) => (
              <li key={w}>
                <a {...link({ who: w })} className={styles.item} aria-current={query.who === w}>
                  <i aria-hidden="true" />
                  {WHO_LABEL[w]}
                  <span>{meta.wears?.[w]}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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

      {states ? (
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
          {shownStates.length < regions.length || allStates ? (
            <button type="button" className={styles.more} onClick={() => setAllStates((v) => !v)}>
              {allStates ? 'Show fewer' : `Show all ${regions.length} states`}
            </button>
          ) : null}
        </section>
      ) : null}

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

      {sizeCount > 0 ? (
        <section className={styles.group} aria-labelledby="f-size">
          <div className={styles.head}>
            <h3 id="f-size">{productType === 'food' ? 'Pack' : 'Size'}</h3>
            {query.sizes.length > 0 ? (
              <a {...link({ sizes: [] })} className={styles.clear}>
                Clear
              </a>
            ) : null}
          </div>
          {groups.map((g) => (
            <div key={g.key} className={styles.sizeGroup}>
              {groups.length > 1 ? <p className={styles.sizeLabel}>{g.label}</p> : null}
              <div className={styles.boxes}>
                {g.sizes.map((s) => {
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
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
