import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getAdminProduct, getPricingSettings } from '@repo/db/admin';
import { formatUsd, suggestPrice } from '@repo/shared/domain';

import {
  addVariantAction,
  setProductStatusAction,
  setQtyAction,
  updateProductAction,
} from '@/features/admin/actions/catalog';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Cell, Field, input, PageTitle, Table, utc } from '@/features/admin/ui';

type Params = Promise<{ id: string }>;

const money = (cents: number) => (cents / 100).toFixed(2);

/** Product editor: fields, publish state, variants and stock (flows.md §2, §9). */
export default async function AdminProductPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [product, settings] = await Promise.all([
    getAdminProduct(client, id),
    getPricingSettings(client),
  ]);
  if (!product) notFound();
  // Suggestion only (flows.md §2 step 4); null until every pricing setting and a weight exist (D-047).
  const weightG = product.variants.find((v) => v.weight_g !== null)?.weight_g ?? null;
  const suggestion =
    product.shop_price_paise === null
      ? null
      : suggestPrice(
          { shopPricePaise: product.shop_price_paise, weightG },
          {
            fxInrPerUsd: settings.fx_inr_per_usd,
            freightCentsPerKg: settings.freight_cents_per_kg,
            dutyPct: settings.duty_pct,
            marginPct: settings.margin_pct,
          },
        );
  const statuses = ['draft', 'live', 'paused', 'archived'] as const;

  return (
    <div className="space-y-6">
      <PageTitle>{product.name}</PageTitle>
      <p>
        {product.product_type} · status <strong>{product.status}</strong>
        {product.published_at ? ` · first published ${utc(product.published_at)}` : ''}
        {product.status === 'live' ? (
          <>
            {' '}
            ·{' '}
            <Link href={`/search?q=${encodeURIComponent(product.name)}`} className="underline">
              find it in the store
            </Link>
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {statuses
          .filter((s) => s !== product.status)
          .map((s) => (
            <form key={s} action={setProductStatusAction.bind(null, product.id, s)}>
              <button type="submit" className={s === 'live' ? button : 'min-h-11 underline'}>
                {s === 'live' ? 'Publish' : `Set ${s}`}
              </button>
            </form>
          ))}
      </div>
      {product.product_type === 'spice' ? (
        <p className="text-caution">
          Spices cannot be published until the compliance question is answered (D-032, Q-10).
        </p>
      ) : null}

      <form
        action={updateProductAction.bind(null, product.id)}
        className="grid max-w-2xl gap-3 sm:grid-cols-2"
      >
        <Field label="Name">
          <input name="name" required defaultValue={product.name} className={input} />
        </Field>
        <Field label="Craft / style">
          <input name="craft" defaultValue={product.craft ?? ''} className={input} />
        </Field>
        <Field label="Price (USD)">
          <input
            name="price"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={money(product.price_cents)}
            className={input}
          />
        </Field>
        <Field label="Shop price (₹, admin only)">
          <input
            name="shopPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              product.shop_price_paise === null ? '' : (product.shop_price_paise / 100).toFixed(2)
            }
            className={input}
          />
        </Field>
        <div className="sm:col-span-2">
          <p className="text-ink-muted">
            {suggestion
              ? `Suggested price ${formatUsd(suggestion.suggestedPriceCents)} (landed cost ${formatUsd(suggestion.landedCents)})`
              : 'No suggested price: needs the shop price, a variant weight and every pricing setting (D-047).'}
          </p>
        </div>
        <Field label="Summary">
          <input name="summary" defaultValue={product.summary ?? ''} className={input} />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            rows={4}
            defaultValue={product.description ?? ''}
            className={input}
          />
        </Field>
        <Field label="Story">
          <textarea name="story" rows={4} defaultValue={product.story ?? ''} className={input} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className={button}>
            Save
          </button>
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="font-medium">Variants and stock</h2>
        <Table
          head={[
            'Variant',
            'SKU',
            'Listed',
            'Reserved',
            'Confirmed with shop',
            'Correct listed qty',
          ]}
        >
          {product.variants.map((v) => (
            <tr key={v.id}>
              <Cell>
                {v.label}
                {v.price_cents ? ` · $${money(v.price_cents)}` : ''}
              </Cell>
              <Cell>{v.sku}</Cell>
              <Cell>{v.qty_listed}</Cell>
              <Cell>{v.qty_reserved}</Cell>
              <Cell>{utc(v.qty_confirmed_at)}</Cell>
              <Cell>
                <form action={setQtyAction.bind(null, product.id, v.id)} className="flex gap-2">
                  <input
                    name="qty"
                    type="number"
                    min={v.qty_reserved}
                    defaultValue={v.qty_listed}
                    className="border-line min-h-11 w-20 rounded-sm border px-2"
                  />
                  <input
                    name="note"
                    placeholder="note"
                    className="border-line min-h-11 w-32 rounded-sm border px-2"
                  />
                  <button type="submit" className="min-h-11 underline">
                    Set
                  </button>
                </form>
              </Cell>
            </tr>
          ))}
        </Table>
        <form
          action={addVariantAction.bind(null, product.id)}
          className="flex flex-wrap items-end gap-2"
        >
          <Field label="Label">
            <input name="label" required className={input} placeholder="Free size / 200 g" />
          </Field>
          <Field label="SKU">
            <input name="sku" required className={input} />
          </Field>
          <Field label="Pieces at the shop">
            <input name="qty" type="number" min="0" required className={input} />
          </Field>
          <Field label="Price override (USD)">
            <input name="price" type="number" step="0.01" className={input} />
          </Field>
          <Field label="Weight (g)">
            <input name="weightG" type="number" min="1" className={input} />
          </Field>
          <button type="submit" className={button}>
            Add variant
          </button>
        </form>
      </section>
    </div>
  );
}
