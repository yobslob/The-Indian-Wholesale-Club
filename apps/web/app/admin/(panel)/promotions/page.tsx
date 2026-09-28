import { listPromoCodes } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { createPromoAction, togglePromoAction } from '@/features/admin/actions/settings';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Cell, Field, input, PageTitle, Table, utc } from '@/features/admin/ui';

/** Promo codes (kept from the old admin). Redemption is limit-checked in SQL. */
export default async function PromotionsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const promos = await listPromoCodes(client);
  return (
    <div className="space-y-6">
      <PageTitle>Promotions</PageTitle>
      <Table head={['Code', 'Discount', 'Min order', 'Uses', 'Valid until', 'Active', '']}>
        {promos.map((p) => (
          <tr key={p.id}>
            <Cell>{p.code}</Cell>
            <Cell>
              {p.discount_type === 'percentage'
                ? `${p.discount_value}%`
                : formatUsd(p.discount_value)}
            </Cell>
            <Cell>{formatUsd(p.min_order_cents)}</Cell>
            <Cell>
              {p.uses_count}
              {p.max_uses ? ` / ${p.max_uses}` : ''}
            </Cell>
            <Cell>{utc(p.valid_until)}</Cell>
            <Cell>{p.is_active ? 'yes' : 'no'}</Cell>
            <Cell>
              <form action={togglePromoAction.bind(null, p.id, !p.is_active)}>
                <button type="submit" className="min-h-11 underline">
                  {p.is_active ? 'Turn off' : 'Turn on'}
                </button>
              </form>
            </Cell>
          </tr>
        ))}
      </Table>
      <form
        action={createPromoAction}
        className="border-line grid max-w-2xl gap-3 rounded-md border p-3 sm:grid-cols-3"
      >
        <h2 className="font-medium sm:col-span-3">New code</h2>
        <Field label="Code">
          <input name="code" required className={input} />
        </Field>
        <Field label="Type">
          <select name="discountType" className={input} defaultValue="percentage">
            <option value="percentage">Percent off</option>
            <option value="fixed">Dollars off</option>
          </select>
        </Field>
        <Field label="Value (% or $)">
          <input name="value" type="number" step="0.01" min="0.01" required className={input} />
        </Field>
        <Field label="Minimum order ($)">
          <input name="minOrder" type="number" step="0.01" min="0" className={input} />
        </Field>
        <Field label="Max uses">
          <input name="maxUses" type="number" min="1" className={input} />
        </Field>
        <Field label="Valid until (UTC date)">
          <input name="validUntil" type="date" className={input} />
        </Field>
        <div className="sm:col-span-3">
          <button type="submit" className={button}>
            Create code
          </button>
        </div>
      </form>
    </div>
  );
}
