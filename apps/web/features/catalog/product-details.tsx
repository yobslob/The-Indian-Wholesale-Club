import { clothingAttributesSchema, spiceAttributesSchema } from '@repo/shared/domain';

import type { Product, Variant } from '@repo/db/store';

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

/** True when the listing has anything for the "Details" section. */
export function hasDetails(product: Product): boolean {
  return Boolean(product.description || product.craft || product.story) || attributeRows(product).length > 0;
}

/** Description, craft, attributes and story: the "Details" section of the product page. */
export function ProductDetails({ product }: { product: Product }): React.JSX.Element {
  const rows = attributeRows(product);
  return (
    <div className="space-y-3">
      {product.description ? <p className="whitespace-pre-line">{product.description}</p> : null}
      {product.craft || rows.length > 0 ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
          {product.craft ? (
            <>
              <dt className="text-ink-muted">Craft</dt>
              <dd>{product.craft}</dd>
            </>
          ) : null}
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {product.story ? <p className="text-ink-muted whitespace-pre-line">{product.story}</p> : null}
    </div>
  );
}

/**
 * "Size chart" (D-051) from what the listing actually holds: each size option, and the fabric length
 * when it is known. Null when there is nothing to show (no invented measurements, D-012).
 */
export function sizeChart(product: Product, variants: Variant[]): React.JSX.Element | null {
  if (product.product_type !== 'clothing') return null;
  const attrs = clothingAttributesSchema.safeParse(product.attributes);
  const length = attrs.success ? attrs.data.length_m : undefined;
  // Each size once, even when it comes in several colours.
  const sizes = [
    ...new Set(
      variants.map((v) => (typeof v.options.size === 'string' ? v.options.size : null)).filter((s): s is string => s !== null),
    ),
  ];
  if (sizes.length === 0 && length === undefined) return null;
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="font-ui text-ink-muted text-left text-[11px] font-semibold uppercase tracking-[0.08em]">
          <th className="border-line border-b px-2 py-1.5">Size</th>
          {length !== undefined ? <th className="border-line border-b px-2 py-1.5">Length</th> : null}
        </tr>
      </thead>
      <tbody>
        {(sizes.length > 0 ? sizes : ['One size']).map((size) => (
          <tr key={size}>
            <td className="border-line border-b px-2 py-1.5">{size}</td>
            {length !== undefined ? <td className="border-line border-b px-2 py-1.5">{length} m</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
