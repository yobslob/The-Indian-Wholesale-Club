import { clothingAttributesSchema, detailRows, netQuantity, specPairs, type PhotoNote } from '@repo/shared/domain';

import type { Product, Variant } from '@repo/db/store';

export { photoNote } from '@repo/shared/domain';

/**
 * Description, craft, attributes (food: its net quantity first, D-133), where it is from and what the photos are
 * (D-100), then the story: the "Details" section of the product page, above the Size chart.
 */
export function ProductDetails({
  product,
  photos,
  variants,
}: {
  product: Product;
  photos: PhotoNote;
  variants: Variant[];
}): React.JSX.Element {
  const rows = detailRows({ ...product, net_quantity: netQuantity(variants) }, photos);
  return (
    <div className="space-y-3">
      {product.description ? <Description text={product.description} /> : null}
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

/**
 * The description, each paragraph as written; a paragraph that is a shop's run of specs ("Composition: … Fit: …")
 * reads as a list instead (D-140, L4).
 */
function Description({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="space-y-2">
      {text
        .split(/\n{2,}|\n(?=\s*[•-])/)
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para, i) => {
          const pairs = specPairs(para);
          return pairs ? (
            <ul key={i} className="m-0 grid list-none gap-1 p-0">
              {pairs.map(([k, v]) => (
                <li key={k}>
                  <span className="text-ink-muted">{k}:</span> {v}
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="m-0 whitespace-pre-line">
              {para}
            </p>
          );
        })}
    </div>
  );
}
