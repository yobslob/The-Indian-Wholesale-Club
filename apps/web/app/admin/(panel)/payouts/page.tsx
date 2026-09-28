import { listAllPayablePickups } from '@repo/db/admin';

import { recordPayoutAction } from '@/features/admin/actions/cycles';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Empty, Field, input, PageTitle, rupees } from '@/features/admin/ui';

/** Payouts (flows.md §5, D-005): what each shop is owed for picked pieces; record a payment. */
export default async function PayoutsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const pickups = await listAllPayablePickups(client);
  const byVendor = new Map<
    string,
    {
      name: string;
      method: string | null;
      reference: string | null;
      ids: string[];
      paise: number;
      lines: string[];
    }
  >();
  for (const p of pickups) {
    if (!p.vendor) continue;
    const g = byVendor.get(p.vendor.id) ?? {
      name: p.vendor.shop_name,
      method: p.vendor.payment_method,
      reference: p.vendor.payment_reference,
      ids: [],
      paise: 0,
      lines: [],
    };
    g.ids.push(p.id);
    g.paise += p.quantity * (p.shop_price_paise ?? 0);
    g.lines.push(
      `${p.item?.product_name ?? 'Item'} · ${p.item?.variant_label ?? ''} × ${p.quantity}`,
    );
    byVendor.set(p.vendor.id, g);
  }

  return (
    <div className="space-y-6">
      <PageTitle>Payouts</PageTitle>
      {byVendor.size === 0 ? <Empty>Nothing to pay right now.</Empty> : null}
      {[...byVendor.entries()].map(([vendorId, g]) => (
        <section key={vendorId} className="border-line space-y-2 rounded-md border p-3">
          <h2 className="font-medium">
            {g.name} · owed {rupees(g.paise)}
          </h2>
          <ul className="text-ink-muted">
            {g.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <form
            action={recordPayoutAction.bind(null, vendorId, g.ids)}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="Method">
              <input name="method" required defaultValue={g.method ?? ''} className={input} />
            </Field>
            <Field label="Reference">
              <input
                name="reference"
                defaultValue=""
                className={input}
                placeholder={g.reference ?? 'UPI / bank ref'}
              />
            </Field>
            <button type="submit" className={button}>
              Record payout
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
