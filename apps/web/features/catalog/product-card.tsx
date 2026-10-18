import Link from 'next/link';

import { formatUsd, productPath } from '@repo/shared/domain';

import { SaveButton } from '@/features/account/save-button';
import { mediaUrl } from '@/lib/site';

import { QuickAdd } from './quick-add';
import { StorePhoto } from './store-photo';

import type { ProductCard as ProductCardData, RegionProductCard } from '@repo/db/store';

type CardData = ProductCardData & Partial<Pick<RegionProductCard, 'available' | 'quick_add'>>;

/**
 * The photo's `sizes`: the width the card really has at each screen width, so the browser downloads exactly the
 * pixels it shows (sharp, never upscaled, nothing wasted; PR-6). Rows: the fixed widths of product-row.tsx
 * (clamp(176px, 23vw, 304px) and clamp(148px, 17vw, 224px)). Grids: ProductGrid's columns at Tailwind's md (768)
 * and xl (1280).
 */
const SIZES = {
  row: {
    md: '(min-width: 1322px) 304px, (min-width: 766px) 23vw, 176px',
    sm: '(min-width: 1318px) 224px, (min-width: 871px) 17vw, 148px',
  },
  grid: {
    md: '(min-width: 1280px) 25vw, 50vw',
    sm: '(min-width: 1280px) 20vw, (min-width: 768px) 34vw, 50vw',
  },
  // See all's grid beside the filter panel (D-136): three columns from lg (1024), four from 2xl (1536)
  side: {
    md: '(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, 50vw',
    sm: '(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, 50vw',
  },
} as const;

/**
 * The founder's reference card (D-050): a rounded 3 : 4 photo with a round + on it (D-080), then the name and
 * price · region across the card's full width; a food piece's pack size sits on its photo (D-122). `size="sm"` is the smaller card of the product page grids (D-051).
 * Server component; the + and the heart (D-140) are its client islands.
 */
export function ProductCard({
  product,
  size = 'md',
  badge,
  reveal = true,
  layout = 'grid',
  corner,
}: {
  product: CardData;
  size?: 'md' | 'sm';
  /** In a sideways row (fixed width), a grid (a column) or See all's grid beside the filters. */
  layout?: 'row' | 'grid' | 'side';
  badge?: React.ReactNode;
  /** Top right of the photo: the profile's filled heart that removes a saved piece (D-089). */
  corner?: React.ReactNode;
  /** The scroll reveal (D-049). Off for cards that start off to the side in a row: animating dozens made scrolling stutter. */
  reveal?: boolean;
}): React.JSX.Element {
  const href = productPath(product.region_slug, product.slug);
  const small = size === 'sm';
  return (
    <article className="relative min-w-0">
      <div className="relative">
        <Link
          href={href}
          className={`bg-land group relative block aspect-[3/4] overflow-hidden ${small ? 'rounded-[18px]' : 'rounded-lg'}`}
          data-reveal={reveal ? '' : undefined}
        >
          {product.primary_image_path ? (
            <StorePhoto
              src={mediaUrl(product.primary_image_path)}
              alt={product.name}
              sizes={SIZES[layout][size]}
              className="duration-slow object-cover transition-transform group-hover:scale-[1.025]"
            />
          ) : (
            <span className="text-ink-muted font-ui absolute inset-0 grid place-items-center text-xs">
              Photo coming soon
            </span>
          )}
          {badge ? (
            <span className="bg-paper font-ui rounded-pill absolute left-3.5 top-3.5 px-3 py-1.5 text-xs font-medium">
              {badge}
            </span>
          ) : null}
          {product.pack ? (
            // D-122: a food piece's pack size, so two prices read side by side make sense
            <span className="bg-paper/75 font-ui rounded-pill absolute bottom-3.5 left-3.5 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
              {product.pack}
            </span>
          ) : null}
        </Link>
        {product.coming_soon ? (
          // D-135: not on sale yet: the heart instead of the +, and what saving does (D-140, S7)
          <div className="absolute bottom-2.5 right-2.5 z-[1] flex items-center gap-2">
            <span className="bg-paper/85 font-ui rounded-pill max-w-[150px] px-2.5 py-1 text-[11.5px] font-medium leading-tight">
              Save it, we&apos;ll show it in Saved when it&apos;s back
            </span>
            <SaveButton productId={product.id} small />
          </div>
        ) : (
          <QuickAdd
            product={product}
            quickAdd={product.quick_add}
            options={product.options}
            available={product.available}
            href={href}
          />
        )}
        {corner ? (
          <div className="absolute right-2.5 top-2.5 z-[2]">{corner}</div>
        ) : !product.coming_soon ? (
          // D-140 (F6): save from any card, top right of the photo
          <div className="absolute right-2.5 top-2.5 z-[2]">
            <SaveButton productId={product.id} small />
          </div>
        ) : null}
      </div>
      <div className={small ? 'pl-2 pt-2.5' : 'pl-3.5 pr-1.5 pt-3.5'}>
        <Link
          href={href}
          className={`font-ui block font-semibold leading-snug ${small ? 'text-[13.5px]' : 'text-[15px]'}`}
        >
          {product.name}
        </Link>
        <span className={`text-ink-muted ${small ? 'text-[13px]' : 'text-sm'}`}>
          {product.coming_soon ? 'Coming soon' : formatUsd(product.price_cents)}
          {product.region_name ? ` · ${product.region_name}` : null}
        </span>
      </div>
    </article>
  );
}

/** The reference grid: four equal columns (five for small cards), two on phones; its columns drift with the scroll (D-116). */
export function ProductGrid({
  children,
  size = 'md',
}: {
  children: React.ReactNode;
  size?: 'md' | 'sm';
}): React.JSX.Element {
  return (
    <div
      className={
        size === 'sm'
          ? 'drift drift-cols-3 drift-cols-5 grid grid-cols-2 gap-x-[var(--gap)] gap-y-7 md:grid-cols-3 xl:grid-cols-5'
          : 'drift grid grid-cols-2 gap-x-[var(--gap)] gap-y-[clamp(28px,3vw,44px)] xl:grid-cols-4'
      }
    >
      {children}
    </div>
  );
}
