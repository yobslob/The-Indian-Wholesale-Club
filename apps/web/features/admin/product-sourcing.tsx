import { listProductSources } from '@repo/db/admin';
import { siteLabel } from '@repo/shared/sourcing';

import { updateDetailsAction } from './actions/details';
import { checkSoonAction } from './import/auto/actions';
import { button, Cell, Field, input, rupees, Sub, Table, When } from './ui';

import type { IwcClient, Json } from '@repo/db';
import type { ProductType } from '@repo/shared/domain';

/**
 * A product page's sourcing parts (D-118): the details customers must see (a found listing may arrive without them)
 * and every shop the piece can be ordered from, the one in use first for each variant.
 */

const text = (a: Json, key: string): string => {
  const v = a && typeof a === 'object' && !Array.isArray(a) ? a[key] : undefined;
  return Array.isArray(v)
    ? v.join(', ')
    : typeof v === 'string' || typeof v === 'number'
      ? String(v)
      : '';
};

export function DetailsForm({
  id,
  type,
  attributes,
}: {
  id: string;
  type: ProductType;
  attributes: Json;
}): React.JSX.Element {
  const field = (name: string, label: string, key: string, required = true, area = false) => (
    <Field label={label}>
      {area ? (
        <textarea
          name={name}
          rows={3}
          required={required}
          defaultValue={text(attributes, key)}
          className={input}
        />
      ) : (
        <input
          name={name}
          required={required}
          defaultValue={text(attributes, key)}
          className={input}
        />
      )}
    </Field>
  );
  return (
    <form
      action={updateDetailsAction.bind(null, id, type)}
      className="grid max-w-2xl gap-3 sm:grid-cols-2"
    >
      <h2 className="font-heading text-[15px] font-semibold sm:col-span-2">
        Details customers see
      </h2>
      {type === 'clothing' ? (
        <>
          {field('fibre', 'Fibre (e.g. 100% cotton)', 'fibre_content')}
          {field('care', 'Care', 'care')}
        </>
      ) : type === 'home' ? (
        <>
          {field('material', 'Material', 'material')}
          {field('care', 'Care (optional)', 'care', false)}
        </>
      ) : (
        <>
          <div className="sm:col-span-2">
            {field('ingredients', 'Ingredients', 'ingredients', true, true)}
          </div>
          {field(
            'allergens',
            'Allergens, comma-separated (empty: none declared)',
            'allergens',
            false,
          )}
          <Field label="Shelf life (days)">
            <input
              name="shelfLifeDays"
              type="number"
              min={1}
              max={3650}
              required
              defaultValue={text(attributes, 'shelf_life_days')}
              className={input}
            />
          </Field>
          {field('storage', 'Storage (optional)', 'storage', false)}
        </>
      )}
      <div className="sm:col-span-2">
        <button type="submit" className={button}>
          Save details
        </button>
      </div>
    </form>
  );
}

export async function SourcesTable({
  client,
  productId,
  variants,
}: {
  client: IwcClient;
  productId: string;
  variants: { id: string; label: string; source_id: string | null }[];
}): Promise<React.JSX.Element | null> {
  const sources = await listProductSources(client, productId);
  if (!sources.length) return null;
  const inUse = new Set(variants.map((v) => v.source_id));
  const label = new Map(variants.map((v) => [v.id, v.label]));
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-[15px] font-semibold">Where to order it</h2>
      <Table
        head={['Variant', 'Shop', { label: 'Price', right: true }, 'Stock', 'Days', 'Checked']}
      >
        {sources.map((s) => (
          <tr key={s.id}>
            <Cell>{label.get(s.variant_id)}</Cell>
            <Cell>
              <a href={s.item_url} target="_blank" rel="noreferrer" className="underline">
                {siteLabel(s.site)}
              </a>
              {inUse.has(s.id) ? <Sub>ordered from here</Sub> : null}
            </Cell>
            <Cell className="text-right">
              {rupees(s.price_paise)}
              {s.review ? <Sub>held: {rupees(s.review_price_paise)}</Sub> : null}
            </Cell>
            <Cell>{s.in_stock === null ? '—' : s.in_stock ? 'In stock' : 'Sold out'}</Cell>
            <Cell>{s.delivery_days ?? '—'}</Cell>
            <Cell>
              <When iso={s.checked_at} />
              {s.fail_count ? (
                <Sub>
                  {s.fail_count} failed read{s.fail_count === 1 ? '' : 's'}: {s.last_error}
                </Sub>
              ) : null}
            </Cell>
          </tr>
        ))}
      </Table>
      <form action={checkSoonAction.bind(null, productId)}>
        <button type="submit" className="min-h-11 underline">
          Check it in the next run
        </button>
      </form>
    </section>
  );
}
