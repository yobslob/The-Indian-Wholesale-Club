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

const input = 'min-h-11 w-full rounded-sm border border-line bg-canvas px-3';

export default async function AddressesPage(): Promise<React.JSX.Element> {
  const { client } = await requireCustomer('/account/addresses');
  const addresses = await listMyAddresses(client);

  return (
    <div className="space-y-8">
      <h1 className="text-ink text-2xl font-semibold">Addresses</h1>
      {addresses.length > 0 ? (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="border-line rounded-md border p-4 text-sm">
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
        <h2 className="text-ink text-lg font-medium">Add an address</h2>
        <label className="block text-sm">
          Label (optional)
          <input name="label" className={input} />
        </label>
        <label className="block text-sm">
          Full name
          <input name="fullName" required className={input} />
        </label>
        <label className="block text-sm">
          Street address
          <input name="line1" required className={input} />
        </label>
        <label className="block text-sm">
          Apartment, suite
          <input name="line2" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            City
            <input name="city" required className={input} />
          </label>
          <label className="block text-sm">
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
          <label className="block text-sm">
            ZIP code
            <input name="zipCode" required className={input} />
          </label>
          <label className="block text-sm">
            Phone
            <input name="phone" type="tel" className={input} />
          </label>
        </div>
        <button type="submit" className="bg-brand text-canvas min-h-11 rounded-sm px-4 text-sm">
          Save address
        </button>
      </form>
    </div>
  );
}
