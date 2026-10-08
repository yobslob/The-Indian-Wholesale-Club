import { SignInCard } from '@/features/auth/sign-in-card';
import { safeNextPath } from '@/lib/site';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

type SearchParams = Promise<{ next?: string; link?: string }>;

/** The profile's sign-in card, centred (D-091). `?link=expired`: an emailed link that was used or ran out. */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { next, link } = await searchParams;
  return (
    <>
      {link === 'expired' ? (
        <p className="bg-surface font-body mx-auto mt-4 max-w-[440px] rounded-md px-4 py-3 text-sm" role="status">
          That link has expired or was already used. Ask for a new one below.
        </p>
      ) : null}
      <SignInCard next={safeNextPath(next, '/account')} />
    </>
  );
}
