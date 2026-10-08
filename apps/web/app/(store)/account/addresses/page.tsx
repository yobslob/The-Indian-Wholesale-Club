import { listMyAddresses } from '@repo/db/account';
import { US_STATES } from '@repo/shared/domain';

import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from '@/features/account/actions';
import { requireCustomer } from '@/features/account/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Addresses', robots: { index: false } };

const input = 'min-h-12 w-full rounded-md border border-line bg-paper px-3.5 text-[15px] outline-none focus:border-ink';

export default async function AddressesPage(): Promise<React.JSX.Element> {
  const { client } = await requireCustomer('/account/addresses');
  const addresses = await listMyAddresses(client);

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Addresses</h1>
      {addresses.length > 0 ? (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="border-line rounded-lg border p-5 text-sm">
              <p className="font-medium">
                {a.label ?? a.full_name}
                {a.is_default ? <span className="text-ink-muted ml-2 text-xs">Default</span> : null}
              </p>
              <p className="text-ink-muted">
                {[a.full_name, a.line1, a.line2, `${a.city}, ${a.state} ${a.zip_code}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-2 flex gap-4">
                {!a.is_default ? (
                  <form action={setDefaultAddressAction.bind(null, a.id)}>
                    <button type="submit" className="min-h-11 underline">
                      Make default
                    </button>
                  </form>
                ) : null}
                <form action={deleteAddressAction.bind(null, a.id)}>
                  <button type="submit" className="min-h-11 underline">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">No saved addresses yet.</p>
      )}

      <form action={addAddressAction} className="grid max-w-xl gap-4">
        <h2 className="font-heading text-ink text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em]">Add an address</h2>
        <label className="font-ui block text-[13px] font-medium">
          Label (optional)
          <input name="label" className={input} />
        </label>
        <label className="font-ui block text-[13px] font-medium">
          Full name
          <input name="fullName" required className={input} />
        </label>
        <label className="font-ui block text-[13px] font-medium">
          Street address
          <input name="line1" required className={input} />
        </label>
        <label className="font-ui block text-[13px] font-medium">
          Apartment, suite
          <input name="line2" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="font-ui block text-[13px] font-medium">
            City
            <input name="city" required className={input} />
          </label>
          <label className="font-ui block text-[13px] font-medium">
            State
            <select name="state" required className={input} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="font-ui block text-[13px] font-medium">
            ZIP code
            <input name="zipCode" required className={input} />
          </label>
          <label className="font-ui block text-[13px] font-medium">
            Phone
            <input name="phone" type="tel" className={input} />
          </label>
        </div>
        <button type="submit" className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] font-medium">
          Save address
        </button>
      </form>
    </div>
  );
}
