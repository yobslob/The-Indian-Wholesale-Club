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
      <h1 className="font-hero text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Your account</h1>
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
        <label className="font-ui text-ink block text-[13px] font-medium">
          Full name
          <input
            name="fullName"
            defaultValue={profile?.full_name ?? ''}
            className="border-line bg-paper focus:border-ink min-h-12 w-full rounded-md border px-3.5 text-[15px] outline-none"
          />
        </label>
        <label className="font-ui text-ink block text-[13px] font-medium">
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ''}
            className="border-line bg-paper focus:border-ink min-h-12 w-full rounded-md border px-3.5 text-[15px] outline-none"
          />
        </label>
        <button type="submit" className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] font-medium">
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
