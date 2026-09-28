import Image from 'next/image';
import Link from 'next/link';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import type { ProductCard as ProductCardData } from '@repo/db/store';

/** Photo, name, region, price (+ availability on region pages). Server component. */
export function ProductCard({
  product,
  available,
}: {
  product: ProductCardData;
  available?: number;
}): React.JSX.Element {
  return (
    <Link
      href={`/states/${product.region_slug}/${product.slug}`}
      className="border-line bg-canvas hover:border-ink group block rounded-md border p-3"
    >
      <div className="bg-surface relative mb-3 aspect-[4/5] overflow-hidden rounded-sm">
        {product.primary_image_path ? (
          <Image
            src={mediaUrl(product.primary_image_path)}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <span className="text-ink-muted absolute inset-0 grid place-items-center text-xs">
            Photo coming soon
          </span>
        )}
      </div>
      <p className="text-ink text-sm font-medium group-hover:underline">{product.name}</p>
      <p className="text-ink-muted text-xs">{product.region_name}</p>
      <p className="text-ink mt-1 text-sm">{formatUsd(product.price_cents)}</p>
      {available !== undefined && available <= 0 ? (
        <p className="text-caution text-xs">Sold out</p>
      ) : null}
    </Link>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}
