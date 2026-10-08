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
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Create an account</h1>
      <AuthForm mode="signup" next={next ?? null} />
    </div>
  );
}
