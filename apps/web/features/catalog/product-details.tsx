import Image from 'next/image';

import { clothingAttributesSchema, spiceAttributesSchema } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import type { Media, Product } from '@repo/db/store';

/** Attribute rows for customers. Unknown or invalid attribute data is not shown (D-003). */
function attributeRows(product: Product): [string, string][] {
  if (product.product_type === 'clothing') {
    const parsed = clothingAttributesSchema.safeParse(product.attributes);
    if (!parsed.success) return [];
    const a = parsed.data;
    const rows: [string, string][] = [
      ['Fabric', a.fibre_content],
      ['Care', a.care],
    ];
    if (a.length_m !== undefined) rows.push(['Length', `${a.length_m} m`]);
    if (a.notes) rows.push(['Notes', a.notes]);
    return rows;
  }
  const parsed = spiceAttributesSchema.safeParse(product.attributes);
  if (!parsed.success) return [];
  const a = parsed.data;
  const rows: [string, string][] = [
    ['Ingredients', a.ingredients],
    ['Allergens', a.allergens.length > 0 ? a.allergens.join(', ') : 'None declared'],
    ['Shelf life', `${a.shelf_life_days} days`],
  ];
  if (a.storage) rows.push(['Storage', a.storage]);
  return rows;
}

export function ProductGallery({
  media,
  name,
}: {
  media: Media[];
  name: string;
}): React.JSX.Element {
  if (media.length === 0) {
    return (
      <div className="bg-surface text-ink-muted grid aspect-[4/5] place-items-center rounded-md text-sm">
        Photo coming soon
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {media.map((m, i) => (
        <div key={m.id} className="bg-surface relative aspect-[4/5] overflow-hidden rounded-md">
          <Image
            src={mediaUrl(m.storage_path)}
            alt={m.alt_text || name}
            fill
            priority={i === 0}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

/** Description, craft, attributes and the honest origin line (D-004). */
export function ProductDetails({ product }: { product: Product }): React.JSX.Element {
  const rows = attributeRows(product);
  return (
    <div className="space-y-4 text-sm">
      {product.description ? (
        <p className="text-ink whitespace-pre-line">{product.description}</p>
      ) : null}
      {product.craft ? (
        <p className="text-ink">
          <span className="text-ink-muted">Craft: </span>
          {product.craft}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {product.story ? <p className="text-ink-muted whitespace-pre-line">{product.story}</p> : null}
      <p className="border-line text-ink border-t pt-3">
        Made in India · from {product.region_name} · Imported
      </p>
    </div>
  );
}
