import Link from 'next/link';

import { listAdminProducts } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { Cell, PageTitle, rupees, Table } from '@/features/admin/ui';

type SearchParams = Promise<{ q?: string }>;

/** Catalog: every product with admin-only fields (shop, shop price, stock). */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? '';
  const products = await listAdminProducts(client, { search: q || undefined, limit: 200 });

  return (
    <div className="space-y-4">
      <PageTitle>Catalog</PageTitle>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products"
          className="border-line min-h-11 flex-1 rounded-sm border px-2"
        />
        <button type="submit" className="min-h-11 underline">
          Search
        </button>
      </form>
      <Table
        head={[
          'Product',
          'Type',
          'Status',
          'Region',
          'Shop',
          'Price',
          'Shop price',
          'Listed / reserved',
        ]}
      >
        {products.map((p) => (
          <tr key={p.id}>
            <Cell>
              <Link href={`/admin/catalog/${p.id}`} className="underline">
                {p.name}
              </Link>
              {p.is_placeholder ? <span className="text-caution ml-1 text-xs">(demo)</span> : null}
            </Cell>
            <Cell>{p.product_type}</Cell>
            <Cell>{p.status}</Cell>
            <Cell>{p.region?.name}</Cell>
            <Cell>{p.vendor?.shop_name}</Cell>
            <Cell>{formatUsd(p.price_cents)}</Cell>
            <Cell>{rupees(p.shop_price_paise)}</Cell>
            <Cell>
              {p.variants.reduce((n, v) => n + v.qty_listed, 0)} /{' '}
              {p.variants.reduce((n, v) => n + v.qty_reserved, 0)}
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
