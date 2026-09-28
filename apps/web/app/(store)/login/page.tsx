import { AuthForm } from '@/features/auth/auth-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { next } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-ink text-2xl font-semibold">Sign in</h1>
      <AuthForm mode="login" next={next ?? null} />
    </div>
  );
}
