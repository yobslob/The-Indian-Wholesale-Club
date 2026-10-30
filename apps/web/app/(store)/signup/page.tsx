import { SignInCard } from '@/features/auth/sign-in-card';
import { PictureBeside } from '@/features/visuals/picture-beside';
import { safeNextPath } from '@/lib/site';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

type SearchParams = Promise<{ next?: string }>;

/** The same card as sign-in, opened at "Create an account" (D-091), with the same picture beside it. */
export default async function SignupPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { next } = await searchParams;
  return (
    <PictureBeside id="sign-in">
      <SignInCard start="create" next={safeNextPath(next, '/account')} />
    </PictureBeside>
  );
}
