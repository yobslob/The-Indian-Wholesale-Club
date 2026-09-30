import Image from 'next/image';
import Link from 'next/link';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import { QuickAdd } from './quick-add';

import type { ProductCard as ProductCardData, RegionProductCard } from '@repo/db/store';

type CardData = ProductCardData & Partial<Pick<RegionProductCard, 'available' | 'quick_add'>>;

/**
 * The founder's reference card (D-050): a rounded 3 : 4 photo, the name, price · region and an "Add"
 * button. `size="sm"` is the smaller card of the product page grids (D-051). Server component; "Add"
 * is the only client island.
 */
export function ProductCard({
  product,
  size = 'md',
  badge,
}: {
  product: CardData;
  size?: 'md' | 'sm';
  badge?: React.ReactNode;
}): React.JSX.Element {
  const href = `/states/${product.region_slug}/${product.slug}`;
  const small = size === 'sm';
  return (
    <article className="relative min-w-0">
      <Link
        href={href}
        className={`bg-surface group relative block aspect-[3/4] overflow-hidden ${small ? 'rounded-[18px]' : 'rounded-lg'}`}
      >
        {product.primary_image_path ? (
          <Image
            src={mediaUrl(product.primary_image_path)}
            alt={product.name}
            fill
            sizes={small ? '(min-width: 1100px) 20vw, (min-width: 820px) 33vw, 50vw' : '(min-width: 1100px) 25vw, 50vw'}
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
      <div className={`flex items-center justify-between gap-3 ${small ? 'pl-2 pt-2.5' : 'pl-3.5 pr-1.5 pt-3.5'}`}>
        <div className="min-w-0">
          <Link href={href} className={`font-ui block font-semibold leading-snug ${small ? 'text-[13.5px]' : 'text-[15px]'}`}>
            {product.name}
          </Link>
          <span className={`text-ink-muted ${small ? 'text-[13px]' : 'text-sm'}`}>
            {formatUsd(product.price_cents)} · {product.region_name}
          </span>
        </div>
        <QuickAdd
          product={product}
          quickAdd={product.quick_add}
          available={product.available}
          href={href}
        />
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
