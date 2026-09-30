import Link from 'next/link';

import { listAdminProducts, listCategories, listVendors } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { createProductAction } from '@/features/admin/actions/catalog';
import { requireAdminPage } from '@/features/admin/guard';
import { listingTabs } from '@/features/admin/listing-tabs';
import { button, Cell, Field, input, PageTitle, SectionTitle, Table, Tabs } from '@/features/admin/ui';

const typeOption =
  'font-ui flex min-h-12 flex-col items-center justify-center rounded-md px-3 text-center text-[15px] text-ink ' +
  'peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline peer-focus-visible:outline-2';

/**
 * Listings (flows.md §2), in the approved mockup's admin screen (D-050): a new listing as a phone-sized form (Shop,
 * Type, Category, Name, details for the type, prices), then the drafts to review. Choosing Spice swaps the clothing
 * fields for the spice ones with CSS only (`group-has-*`). The camera, the suggested price and "send for review" are
 * later phases (C3, C6), as the mockup marks them.
 */
export default async function ListingsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [drafts, vendors, categories] = await Promise.all([
    listAdminProducts(client, { status: 'draft' }),
    listVendors(client, { status: 'active' }),
    listCategories(client),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageTitle>Listings</PageTitle>
        <Tabs items={listingTabs(drafts.length)} current="new" />
      </div>

      <form
        action={createProductAction}
        aria-label="New listing"
        className="border-line bg-canvas group grid max-w-2xl gap-4 rounded-lg border p-4 sm:grid-cols-2 sm:p-5"
      >
        <div className="sm:col-span-2">
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
        </div>
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className="font-ui text-ink mb-1.5 text-[13px] font-medium">Type</legend>
          <div className="border-line bg-paper grid grid-cols-2 gap-1 rounded-md border p-1">
            <label>
              <input type="radio" name="productType" value="clothing" defaultChecked className="peer sr-only" />
              <span className={typeOption}>Clothing</span>
            </label>
            <label>
              <input id="type-spice" type="radio" name="productType" value="spice" className="peer sr-only" />
              <span className={typeOption}>
                <span>Spice</span>
                <span className="text-[12px] opacity-80">
                  can&apos;t go live yet <span className="whitespace-nowrap">(D-032)</span>
                </span>
              </span>
            </label>
          </div>
        </fieldset>
        <div className="sm:col-span-2">
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
        </div>
        <Field label="Name">
          <input name="name" required className={input} />
        </Field>
        <Field label="URL slug">
          <input name="slug" required className={input} placeholder="kasavu-mundu-gold-border" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary">
            <input name="summary" className={input} placeholder="One line for the product card" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 group-has-[#type-spice:checked]:hidden sm:col-span-2">
          <Field label="Fabric">
            <input name="fibre" className={input} placeholder="e.g. 100% cotton" />
          </Field>
          <Field label="Care">
            <input name="care" className={input} />
          </Field>
        </div>
        <div className="hidden gap-4 group-has-[#type-spice:checked]:grid sm:col-span-2 sm:grid-cols-3">
          <Field label="Ingredients">
            <input name="ingredients" className={input} />
          </Field>
          <Field label="Allergens (comma separated)">
            <input name="allergens" className={input} />
          </Field>
          <Field label="Shelf life (days)">
            <input name="shelfLifeDays" type="number" min="1" className={input} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
          <Field label="Shop price (₹)">
            <input name="shopPrice" type="number" step="0.01" min="0" className={input} />
          </Field>
          <Field label="Price (USD)">
            <input name="price" type="number" step="0.01" min="0.01" required className={input} />
          </Field>
        </div>
        <p className="text-ink-muted text-[13px] sm:col-span-2">
          Photos, sizes and pieces are added on the draft&apos;s page after saving.
        </p>
        <div className="sm:col-span-2">
          <button type="submit" className={`${button} w-full sm:w-auto`}>
            Save draft
          </button>
        </div>
      </form>

      <section className="space-y-3" aria-labelledby="drafts">
        <SectionTitle id="drafts">Drafts to review ({drafts.length})</SectionTitle>
        {drafts.length === 0 ? (
          <p className="text-ink-muted">No drafts. New listings appear here until they are published.</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}
