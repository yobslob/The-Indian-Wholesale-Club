import Link from 'next/link';

import { getMyProfile } from '@repo/db/account';

import { signOutAction, updateProfileAction } from '@/features/account/actions';
import { requireCustomer } from '@/features/account/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

export default async function AccountPage(): Promise<React.JSX.Element> {
  const { client, user } = await requireCustomer('/account');
  const profile = await getMyProfile(client, user.id);

  return (
    <div className="space-y-8">
      <h1 className="text-ink text-2xl font-semibold">Your account</h1>
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/account/orders" className="underline">
          Orders
        </Link>
        <Link href="/account/addresses" className="underline">
          Addresses
        </Link>
        <Link href="/account/saved" className="underline">
          Saved
        </Link>
      </nav>
      <form action={updateProfileAction} className="grid max-w-sm gap-4">
        <p className="text-ink-muted text-sm">{profile?.email ?? user.email}</p>
        <label className="text-ink block text-sm">
          Full name
          <input
            name="fullName"
            defaultValue={profile?.full_name ?? ''}
            className="border-line bg-canvas min-h-11 w-full rounded-sm border px-3"
          />
        </label>
        <label className="text-ink block text-sm">
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ''}
            className="border-line bg-canvas min-h-11 w-full rounded-sm border px-3"
          />
        </label>
        <button type="submit" className="bg-brand text-canvas min-h-11 rounded-sm px-4 text-sm">
          Save
        </button>
      </form>
      <form action={signOutAction}>
        <button type="submit" className="min-h-11 text-sm underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
