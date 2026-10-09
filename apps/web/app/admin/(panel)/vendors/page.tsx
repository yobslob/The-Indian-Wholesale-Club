import { listRegionsAdmin, listVendors } from '@repo/db/admin';

import { createVendorAction } from '@/features/admin/actions/catalog';
import { Chip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Cell, Field, input, PageHead, Table } from '@/features/admin/ui';

/** Vendors (admin.md, D-018): shops never log in; the founder and COO enter everything. Admin only (D-003). */
export default async function VendorsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [vendors, regions] = await Promise.all([listVendors(client), listRegionsAdmin(client)]);

  return (
    <div className="space-y-6">
      <PageHead title="Vendors" />
      <Table head={['Shop', 'Owner', 'Region', 'Town', 'Phone', 'Payment', 'Status']}>
        {vendors.map((v) => (
          <tr key={v.id} id={`v-${v.id}`} className="scroll-mt-20 target:[&>td]:bg-brand/5">
            <Cell>
              <b className="font-semibold">{v.shop_name}</b>
              {v.is_placeholder ? <span className="text-caution ml-1 text-xs">(demo)</span> : null}
            </Cell>
            <Cell>{v.owner_name ?? '—'}</Cell>
            <Cell>{v.region?.name ?? '—'}</Cell>
            <Cell>{v.town ?? '—'}</Cell>
            <Cell>{[v.phone, v.whatsapp].filter(Boolean).join(' / ') || '—'}</Cell>
            <Cell>
              {[v.payment_method, v.payment_reference].filter(Boolean).join(' · ') || '—'}
            </Cell>
            <Cell>
              <Chip tone={v.status === 'active' ? 'ok' : v.status === 'paused' ? 'warn' : 'mute'}>{v.status === 'active' ? 'Active' : v.status === 'paused' ? 'Paused' : 'Prospect'}</Chip>
            </Cell>
          </tr>
        ))}
      </Table>

      <form
        action={createVendorAction}
        className="border-line grid max-w-2xl gap-3 rounded-[14px] border bg-paper px-[18px] py-4 sm:grid-cols-2"
      >
        <h2 className="font-heading text-[15px] font-semibold sm:col-span-2">Add a shop</h2>
        <Field label="Shop name">
          <input name="shopName" required className={input} />
        </Field>
        <Field label="Owner">
          <input name="ownerName" className={input} />
        </Field>
        <Field label="Region">
          <select name="regionId" required className={input} defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Town">
          <input name="town" className={input} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" className={input} />
        </Field>
        <Field label="WhatsApp">
          <input name="whatsapp" type="tel" className={input} />
        </Field>
        <Field label="Payment method (D-029)">
          <input name="paymentMethod" className={input} placeholder="UPI / bank / cash" />
        </Field>
        <Field label="Payment reference">
          <input name="paymentReference" className={input} />
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={2} className={input} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className={button}>
            Save shop
          </button>
        </div>
      </form>
    </div>
  );
}
