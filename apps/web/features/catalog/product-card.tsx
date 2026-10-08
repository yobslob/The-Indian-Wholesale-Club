import Image from 'next/image';
import Link from 'next/link';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import { QuickAdd } from './quick-add';

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
} as const;

/**
 * The founder's reference card (D-050): a rounded 3 : 4 photo with a round + on it (D-080), then the name and
 * price · region across the card's full width. `size="sm"` is the smaller card of the product page grids (D-051).
 * Server component; the + is the only client island.
 */
export function ProductCard({
  product,
  size = 'md',
  badge,
  reveal = true,
  layout = 'grid',
}: {
  product: CardData;
  size?: 'md' | 'sm';
  /** In a sideways row (fixed width) or a grid (a column). */
  layout?: 'row' | 'grid';
  badge?: React.ReactNode;
  /** The scroll reveal (D-049). Off for cards that start off to the side in a row: animating dozens made scrolling stutter. */
  reveal?: boolean;
}): React.JSX.Element {
  const href = `/states/${product.region_slug}/${product.slug}`;
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
            <Image
              src={mediaUrl(product.primary_image_path)}
              alt={product.name}
              fill
              sizes={SIZES[layout][size]}
              className="duration-slow object-cover transition-transform group-hover:scale-[1.025]"
            />
          ) : (
            <span className="text-ink-muted font-ui absolute inset-0 grid place-items-center text-xs">
              Photo coming soon
            </span>
          )}
          {badge ? (
            <span className="bg-paper font-ui absolute left-3.5 top-3.5 rounded-pill px-3 py-1.5 text-xs font-medium">
              {badge}
            </span>
          ) : null}
        </Link>
        <QuickAdd product={product} quickAdd={product.quick_add} available={product.available} href={href} />
      </div>
      <div className={small ? 'pl-2 pt-2.5' : 'pl-3.5 pr-1.5 pt-3.5'}>
        <Link href={href} className={`font-ui block font-semibold leading-snug ${small ? 'text-[13.5px]' : 'text-[15px]'}`}>
          {product.name}
        </Link>
        <span className={`text-ink-muted ${small ? 'text-[13px]' : 'text-sm'}`}>
          {formatUsd(product.price_cents)} · {product.region_name}
        </span>
      </div>
    </article>
  );
}

/** The reference grid: four equal columns (five for small cards), two on phones. */
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
          ? 'grid grid-cols-2 gap-x-[var(--gap)] gap-y-7 md:grid-cols-3 xl:grid-cols-5'
          : 'grid grid-cols-2 gap-x-[var(--gap)] gap-y-[clamp(28px,3vw,44px)] xl:grid-cols-4'
      }
    >
      {children}
    </div>
  );
}
