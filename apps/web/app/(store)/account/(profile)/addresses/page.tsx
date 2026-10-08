import Link from 'next/link';

import { listMyAddresses } from '@repo/db/account';
import { US_STATES } from '@repo/shared/domain';

import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from '@/features/account/actions';
import { customerOrNull } from '@/features/account/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Addresses', robots: { index: false } };

type Search = Promise<{ edit?: string; add?: string }>;
type Address = Awaited<ReturnType<typeof listMyAddresses>>[number];

const input = 'border-line bg-paper focus:border-ink mt-1.5 block min-h-12 w-full rounded-md border px-3.5 text-[15px] font-normal outline-none';
const field = 'font-ui block text-[13px] font-medium';
const icon = 'hover:bg-surface grid size-10 place-items-center rounded-full';

function Icon({ d }: { d: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Today's address form: empty for "Add an address", filled in for the pencil (D-089). */
function AddressForm({ address }: { address?: Address }): React.JSX.Element {
  const action = address ? updateAddressAction.bind(null, address.id) : addAddressAction;
  return (
    <form action={action} className="bg-surface grid max-w-xl gap-4 rounded-lg p-[clamp(18px,2vw,28px)]">
      <h3 className="font-heading m-0 text-xl font-medium text-[#1D1A17]">{address ? 'Edit address' : 'Add an address'}</h3>
      <label className={field}>
        Label (optional)
        <input name="label" defaultValue={address?.label ?? ''} className={input} />
      </label>
      <label className={field}>
        Full name
        <input name="fullName" required defaultValue={address?.full_name} autoComplete="name" className={input} />
      </label>
      <label className={field}>
        Street address
        <input name="line1" required defaultValue={address?.line1} autoComplete="address-line1" className={input} />
      </label>
      <label className={field}>
        Apartment, suite
        <input name="line2" defaultValue={address?.line2 ?? ''} autoComplete="address-line2" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className={field}>
          City
          <input name="city" required defaultValue={address?.city} autoComplete="address-level2" className={input} />
        </label>
        <label className={field}>
          State
          <select name="state" required className={input} defaultValue={address?.state ?? ''} autoComplete="address-level1">
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
        <label className={field}>
          ZIP code
          <input name="zipCode" required defaultValue={address?.zip_code} autoComplete="postal-code" className={input} />
        </label>
        <label className={field}>
          Phone
          <input name="phone" type="tel" defaultValue={address?.phone ?? ''} autoComplete="tel" className={input} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] font-semibold">
          Save address
        </button>
        <Link href="/account/addresses" className="font-ui text-sm font-medium underline underline-offset-[3px]">
          Cancel
        </Link>
      </div>
    </form>
  );
}

/**
 * Addresses (D-089): a card per address with Default or "Make default", and Edit / Remove as a pencil and a minus in
 * the card's corner. "Add an address" and the pencil open today's form (?add=1, ?edit=<id>), so it works without
 * JavaScript and Back closes it.
 */
export default async function AddressesPage({ searchParams }: { searchParams: Search }): Promise<React.JSX.Element | null> {
  const me = await customerOrNull();
  if (!me) return null;
  const [addresses, { edit, add }] = await Promise.all([listMyAddresses(me.client), searchParams]);
  const editing = addresses.find((a) => a.id === edit);

  return (
    <section aria-labelledby="addresses-h">
      <h2 id="addresses-h" className="font-heading m-0 mb-4 text-[22px] font-medium leading-tight text-[#1D1A17]">
        Addresses
      </h2>
      {editing ? (
        <AddressForm address={editing} />
      ) : (
        <>
          {addresses.length === 0 ? (
            <p className="text-ink-muted font-body m-0 text-[15px]">No saved addresses yet.</p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
              {addresses.map((a) => {
                const name = a.label ?? a.full_name;
                return (
                  <li key={a.id} className="border-line bg-paper font-body relative rounded-lg border py-[18px] pl-[18px] pr-24 text-sm">
                    <b className="font-ui text-[15px] font-semibold">{name}</b>
                    {a.is_default ? (
                      <span className="bg-surface font-ui text-ink-muted ml-2 rounded-pill px-2 py-[3px] text-[11px] font-semibold">Default</span>
                    ) : null}
                    <p className="text-ink-muted mb-3.5 mt-1.5">
                      {a.full_name}
                      <br />
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}
                      <br />
                      {a.city}, {a.state} {a.zip_code}
                    </p>
                    {!a.is_default ? (
                      <form action={setDefaultAddressAction.bind(null, a.id)}>
                        <button type="submit" className="border-line bg-canvas font-ui inline-flex min-h-10 items-center rounded-pill border px-3.5 text-[13px] font-medium">
                          Make default
                        </button>
                      </form>
                    ) : null}
                    <span className="absolute right-2 top-2 flex gap-1">
                      <Link href={`/account/addresses?edit=${a.id}`} className={icon} aria-label={`Edit ${name}`}>
                        <Icon d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                      </Link>
                      <form action={deleteAddressAction.bind(null, a.id)}>
                        <button type="submit" className={icon} aria-label={`Remove ${name}`}>
                          <Icon d="M6 12h12" />
                        </button>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {add ? (
            <div className="mt-4">
              <AddressForm />
            </div>
          ) : (
            <Link
              href="/account/addresses?add=1"
              className="border-ink-muted font-ui mt-4 inline-flex min-h-12 items-center gap-2 rounded-pill border border-dashed px-5 text-sm font-semibold"
            >
              + Add an address
            </Link>
          )}
        </>
      )}
    </section>
  );
}
