import { listAllPayablePickups } from '@repo/db/admin';

import { recordPayoutAction } from '@/features/admin/actions/cycles';
import { ConfirmForm } from '@/features/admin/confirm';
import { requireAdminPage } from '@/features/admin/guard';
import { Empty, Field, input, PageHead, rupees } from '@/features/admin/ui';

/**
 * Payouts (D-096, flows.md §5, D-005): what each shop is owed for picked pieces, as one card per shop with its pieces,
 * then the method and reference and Record payout, which asks first with the amount. The amount is computed in SQL.
 */
export default async function PayoutsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const pickups = await listAllPayablePickups(client);
  const byVendor = new Map<string, { name: string; method: string | null; reference: string | null; ids: string[]; paise: number; lines: string[] }>();
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
    g.lines.push(`${p.item?.product_name ?? 'Item'} · ${p.item?.variant_label ?? ''} × ${p.quantity}`);
    byVendor.set(p.vendor.id, g);
  }
  const total = [...byVendor.values()].reduce((s, g) => s + g.paise, 0);

  return (
    <>
      <PageHead
        title="Payouts"
        sub={byVendor.size ? `${rupees(total)} owed to ${byVendor.size} shop${byVendor.size === 1 ? '' : 's'} for picked pieces` : undefined}
      />
      {byVendor.size === 0 ? <Empty>Nothing to pay right now.</Empty> : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
        {[...byVendor.entries()].map(([vendorId, g]) => (
          <section key={vendorId} className="border-line bg-paper overflow-hidden rounded-[14px] border">
            <div className="px-4 pb-2.5 pt-3.5">
              <h2 className="font-heading text-[16px] font-semibold leading-tight">{g.name}</h2>
              <p className="text-ink-muted mt-0.5 text-[13px]">{[g.method, g.reference].filter(Boolean).join(' · ') || 'No payment method saved'}</p>
            </div>
            <div className="border-line border-t px-4 py-2.5">
              <b className="block text-[22px] font-bold">{rupees(g.paise)}</b>
              <small className="text-ink-muted text-[12.5px]">{g.lines.join(' · ')}</small>
            </div>
            <ConfirmForm
              action={recordPayoutAction.bind(null, vendorId, g.ids)}
              className="border-line grid grid-cols-2 items-end gap-2.5 border-t px-4 py-3 md:grid-cols-[1fr_1fr_auto] [&>button]:col-span-2 md:[&>button]:col-span-1"
              fields={
                <>
                  <Field label="Method">
                    <input name="method" required defaultValue={g.method ?? ''} className={input} />
                  </Field>
                  <Field label="Reference">
                    <input name="reference" placeholder={g.reference ?? 'UPI / bank ref'} className={input} />
                  </Field>
                </>
              }
              label="Record payout"
              title={`Record ${rupees(g.paise)} paid?`}
              confirm={`Record ${rupees(g.paise)}`}
            >
              Paid to <b>{g.name}</b> for {g.ids.length} picked piece{g.ids.length === 1 ? '' : 's'}. It marks them paid to the shop; nothing is sent
              to the customer.
            </ConfirmForm>
          </section>
        ))}
      </div>
    </>
  );
}
