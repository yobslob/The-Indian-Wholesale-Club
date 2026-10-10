import { listJoinRequests, listRegionsAdmin, listVendorAccounts, listVendors } from '@repo/db/admin';
import { languageForRegion } from '@repo/shared/vendor';

import { createVendorAction } from '@/features/admin/actions/catalog';
import { setJoinRequestStatusAction } from '@/features/admin/actions/vendor-accounts';
import { Chip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Cell, Field, input, PageHead, Panel, Table, When } from '@/features/admin/ui';
import { VendorAccess } from '@/features/admin/vendor-access';

/**
 * Vendors (admin.md): shops, their vendor accounts with the one-time QR / link to sign in (D-102), and "Join as a
 * vendor?" requests. Admin only (D-003).
 */
export default async function VendorsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [vendors, regions, accounts, requests] = await Promise.all([
    listVendors(client),
    listRegionsAdmin(client),
    listVendorAccounts(client),
    listJoinRequests(client),
  ]);
  const languages = new Map(regions.map((r) => [r.id, r.languages ?? []]));
  const open = requests.filter((r) => r.status === 'new' || r.status === 'contacted');

  return (
    <div className="space-y-6">
      <PageHead title="Vendors" />
      <Table head={['Shop', 'Owner', 'Region', 'Town', 'Phone', 'Payment', 'Status', 'Sign-in (D-102)']}>
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
            <Cell className="min-w-[260px]">
              <VendorAccess
                vendorId={v.id}
                defaultLanguage={languageForRegion(languages.get(v.region_id ?? '') ?? [])}
                accounts={accounts.filter((a) => a.vendor_id === v.id)}
              />
            </Cell>
          </tr>
        ))}
      </Table>

      {open.length > 0 ? (
        <Panel title="Join requests" note="from the vendor sign-in page">
          <ul className="space-y-3">
            {open.map((r) => (
              <li key={r.id} className="border-line border-b pb-3 text-[14px] last:border-0">
                <b>{r.shop_name}</b> · {r.owner_name} · {r.phone} · {r.country === 'US' ? 'USA (waits for Q-35)' : (r.region?.name ?? '—')}
                {r.city ? ` · ${r.city}` : ''} <span className="text-ink-muted">· <When iso={r.created_at} inline /></span>
                {r.sells ? <p className="text-ink-muted mt-1">{r.sells}</p> : null}
                <div className="mt-1.5 flex gap-3">
                  {(['contacted', 'accepted', 'declined'] as const).map((status) => (
                    <form key={status} action={setJoinRequestStatusAction.bind(null, r.id, status)}>
                      <button disabled={r.status === status} className="underline disabled:no-underline disabled:opacity-60">{status}</button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

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
