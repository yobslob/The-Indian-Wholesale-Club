import { notFound, redirect } from 'next/navigation';

import { adminAccess } from '@/features/admin/guard';
import { AuthForm } from '@/features/auth/auth-form';

/** Admin sign-in (admin.md): admins go straight in; signed-in non-admins get a plain 404. */
export default async function AdminLoginPage(): Promise<React.JSX.Element> {
  const access = await adminAccess();
  if (access.state === 'admin') redirect('/admin');
  if (access.state === 'denied') notFound();
  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-24">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <AuthForm mode="login" afterSignIn="/admin" links={false} />
    </main>
  );
}
