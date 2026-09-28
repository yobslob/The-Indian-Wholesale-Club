import { AuthForm } from '@/features/auth/auth-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create an account' };

type SearchParams = Promise<{ next?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { next } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-ink text-2xl font-semibold">Create an account</h1>
      <AuthForm mode="signup" next={next ?? null} />
    </div>
  );
}
