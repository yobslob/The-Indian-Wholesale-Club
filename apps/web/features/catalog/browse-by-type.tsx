import { listProductsCached } from './data';
import { ProductCard } from './product-card';
import { RegionFilter } from './region-filter';

/** /clothing and /spices: every live product of one type, filterable by region. One cached read. */
export async function BrowseByType({
  productType,
  title,
  emptyText,
}: {
  productType: 'clothing' | 'spice';
  title: string;
  emptyText: string;
}): Promise<React.JSX.Element> {
  const products = await listProductsCached({ productType, limit: 500 });
  const regions = [...new Map(products.map((p) => [p.region_slug, p.region_name])).entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  return (
    <div className="space-y-6">
      <h1 className="text-ink text-2xl font-semibold">{title}</h1>
      {products.length === 0 ? (
        <p className="text-ink-muted">{emptyText}</p>
      ) : (
        <RegionFilter
          regions={regions}
          items={products.map((p) => ({
            key: p.id,
            regionSlug: p.region_slug,
            node: <ProductCard product={p} />,
          }))}
        />
      )}
    </div>
  );
}
