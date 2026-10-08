import { SignInCard } from '@/features/auth/sign-in-card';
import { safeNextPath } from '@/lib/site';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

type SearchParams = Promise<{ next?: string }>;

/** The same card as sign-in, opened at "Create an account" (D-091). */
export default async function SignupPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { next } = await searchParams;
  return <SignInCard start="create" next={safeNextPath(next, '/account')} />;
}
