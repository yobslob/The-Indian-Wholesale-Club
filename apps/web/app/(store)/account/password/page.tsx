import { redirect } from 'next/navigation';

import { NewPasswordCard } from '@/features/auth/new-password-card';
import { currentUser, sessionClient } from '@/lib/supabase/server';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Set a new password', robots: { index: false } };

/** The reset link's page (D-091): /auth/callback has signed the customer in; without that, the link has run out. */
export default async function NewPasswordPage(): Promise<React.JSX.Element> {
  if (!(await currentUser(await sessionClient()))) redirect('/login?link=expired');
  return <NewPasswordCard />;
}
