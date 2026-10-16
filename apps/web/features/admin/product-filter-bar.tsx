'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { input, linkButton } from './styles';

export interface FilterOption {
  value: string;
  label: string;
  /** Categories: the type they belong to, so only the chosen type's show. */
  type?: string;
}

const select = `${input} md:w-auto md:min-w-[150px]`;

/**
 * Products' filters (D-136): type, state (or all-India), category, shop, a price range and the sort, beside the
 * search. Changing a select applies it at once (a soft navigation: the page's data reloads, the page doesn't); the
 * search and the prices apply on Enter or Apply. Hidden fields keep the tab.
 */
export function ProductFilterBar({
  values,
  keep,
  regions,
  categories,
  shops,
  clearHref,
}: {
  values: Record<'q' | 'type' | 'region' | 'category' | 'shop' | 'min' | 'max' | 'sort', string>;
  /** The tab (status, us) carried along. */
  keep: Record<string, string>;
  regions: FilterOption[];
  categories: FilterOption[];
  shops: FilterOption[];
  clearHref: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const go = (form: HTMLFormElement): void => {
    const data = new FormData(form);
    const p = new URLSearchParams();
    for (const [k, v] of data.entries()) if (typeof v === 'string' && v.trim() !== '') p.set(k, v.trim());
    // a category of another type would match nothing
    const type = p.get('type');
    const cat = categories.find((c) => c.value === p.get('category'));
    if (type && cat && cat.type !== type) p.delete('category');
    start(() => router.push(p.size ? `${pathname}?${p.toString()}` : pathname, { scroll: false }));
  };
  const shownCategories = values.type ? categories.filter((c) => c.type === values.type) : categories;

  return (
    <form
      className="space-y-2"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) go(e.currentTarget);
      }}
    >
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="flex gap-2">
        <input name="q" defaultValue={values.q} placeholder="Search products" className={`${input} flex-1`} />
        <button type="submit" className={linkButton}>
          Search
        </button>
      </div>
      <div className={`flex flex-wrap items-center gap-2 transition-opacity ${pending ? 'opacity-60' : ''}`}>
        <select name="type" aria-label="Type" defaultValue={values.type} className={select} key={`t${values.type}`}>
          <option value="">All types</option>
          <option value="clothing">Clothing</option>
          <option value="food">Food</option>
          <option value="home">Home & gifts</option>
        </select>
        <select name="region" aria-label="State" defaultValue={values.region} className={select} key={`r${values.region}`}>
          <option value="">All states</option>
          <option value="none">All-India (no state)</option>
          {regions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select name="category" aria-label="Category" defaultValue={values.category} className={select} key={`c${values.category}${values.type}`}>
          <option value="">All categories</option>
          {shownCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="shop" aria-label="Shop" defaultValue={values.shop} className={select} key={`s${values.shop}`}>
          <option value="">All shops</option>
          {shops.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="inline-flex items-center gap-1.5">
          <input name="min" defaultValue={values.min} key={`mn${values.min}`} inputMode="decimal" placeholder="Min $" aria-label="Lowest US price" className={`${input} w-24 md:w-24`} />
          <span className="text-ink-muted">–</span>
          <input name="max" defaultValue={values.max} key={`mx${values.max}`} inputMode="decimal" placeholder="Max $" aria-label="Highest US price" className={`${input} w-24 md:w-24`} />
          <button type="submit" className={linkButton}>
            Apply
          </button>
        </span>
        <select name="sort" aria-label="Sort" defaultValue={values.sort} className={select} key={`o${values.sort}`}>
          <option value="updated">Recently updated</option>
          <option value="newest">Newest added</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
        {clearHref ? (
          <a
            href={clearHref}
            className={`${linkButton} text-ink-muted text-sm`}
            onClick={(e) => {
              e.preventDefault();
              start(() => router.push(clearHref, { scroll: false }));
            }}
          >
            Clear filters
          </a>
        ) : null}
      </div>
    </form>
  );
}
