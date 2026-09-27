import { Heart, MapPin, Package, User } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignOutButton } from '@/components/account';
import { getProfile } from '@/lib/queries/account';
import { createClient } from '@/lib/supabase/server';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account - ROOT',
  description: 'Manage your ROOT profile, orders, addresses and wishlist.',
  robots: { index: false },
};

const sections = [
  {
    href: '/account/orders',
    icon: Package,
    title: 'Orders',
    description: 'Track shipments and view order history.',
  },
  {
    href: '/account/addresses',
    icon: MapPin,
    title: 'Addresses',
    description: 'Manage saved shipping destinations.',
  },
  {
    href: '/account/wishlist',
    icon: Heart,
    title: 'Wishlist',
    description: 'Products you saved for later.',
  },
];

export default async function AccountPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/account');
  }

  const profile = await getProfile(supabase);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 md:px-8 lg:px-12">
      <div className="border-b border-neutral-200 pb-6">
        <h1 className="font-display text-primary text-3xl font-bold tracking-tight md:text-4xl">
          My Account
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your profile, orders and saved details.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile summary */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <User className="h-6 w-6 text-neutral-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">
                {profile?.full_name || 'ROOT Member'}
              </div>
              <div className="text-xs text-neutral-500">{user.email}</div>
            </div>
          </div>
          <dl className="mt-5 space-y-2 border-t border-neutral-100 pt-4 text-xs">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Member since</dt>
              <dd className="font-medium text-neutral-800">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Email verified</dt>
              <dd className="font-medium text-neutral-800">
                {user.email_confirmed_at ? 'Yes' : 'Pending verification'}
              </dd>
            </div>
          </dl>
          <div className="mt-5">
            <SignOutButton />
          </div>
        </div>

        {/* Section cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-neutral-400"
            >
              <section.icon className="h-5 w-5 text-neutral-700" />
              <div className="mt-3 text-sm font-semibold text-neutral-900">{section.title}</div>
              <div className="mt-1 text-xs leading-relaxed text-neutral-500">
                {section.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
