import Link from 'next/link';

import { listAdminProducts, listCategories, listVendors } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { createProductAction } from '@/features/admin/actions/catalog';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Cell, Field, input, PageTitle, Table } from '@/features/admin/ui';

/**
 * Listings (flows.md §2): new drafts and quantity checks. The phone camera flow
 * with offline drafts is a coding-phase feature (admin.md).
 */
export default async function ListingsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [drafts, vendors, categories] = await Promise.all([
    listAdminProducts(client, { status: 'draft' }),
    listVendors(client, { status: 'active' }),
    listCategories(client),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle>Listings</PageTitle>
      <section className="space-y-2">
        <h2 className="font-medium">Drafts to review ({drafts.length})</h2>
        <Table head={['Product', 'Region', 'Shop', 'Price', 'Pieces']}>
          {drafts.map((p) => (
            <tr key={p.id}>
              <Cell>
                <Link href={`/admin/catalog/${p.id}`} className="underline">
                  {p.name}
                </Link>
              </Cell>
              <Cell>{p.region?.name}</Cell>
              <Cell>{p.vendor?.shop_name}</Cell>
              <Cell>{formatUsd(p.price_cents)}</Cell>
              <Cell>{p.variants.reduce((n, v) => n + v.qty_listed, 0)}</Cell>
            </tr>
          ))}
        </Table>
      </section>

      <form
        action={createProductAction}
        className="border-line grid max-w-2xl gap-3 rounded-md border p-3 sm:grid-cols-2"
      >
        <h2 className="font-medium sm:col-span-2">New listing (saved as a draft)</h2>
        <Field label="Shop">
          <select name="vendorId" required className={input} defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.shop_name} · {v.region?.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select name="productType" required className={input} defaultValue="clothing">
            <option value="clothing">Clothing</option>
            <option value="spice">Spice (cannot go live yet, D-032)</option>
          </select>
        </Field>
        <Field label="Category (must match the type)">
          <select name="categoryId" required className={input} defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.product_type} · {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name">
          <input name="name" required className={input} />
        </Field>
        <Field label="URL slug">
          <input name="slug" required className={input} placeholder="kasavu-mundu-gold-border" />
        </Field>
        <Field label="Price (USD)">
          <input name="price" type="number" step="0.01" min="0.01" required className={input} />
        </Field>
        <Field label="Shop price (₹, admin only)">
          <input name="shopPrice" type="number" step="0.01" min="0" className={input} />
        </Field>
        <Field label="Summary">
          <input name="summary" className={input} />
        </Field>
        <Field label="Clothing: fabric (e.g. 100% cotton)">
          <input name="fibre" className={input} />
        </Field>
        <Field label="Clothing: care">
          <input name="care" className={input} />
        </Field>
        <Field label="Spice: ingredients">
          <input name="ingredients" className={input} />
        </Field>
        <Field label="Spice: allergens (comma separated)">
          <input name="allergens" className={input} />
        </Field>
        <Field label="Spice: shelf life (days)">
          <input name="shelfLifeDays" type="number" min="1" className={input} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className={button}>
            Create draft
          </button>
        </div>
      </form>
    </div>
  );
}
