import { notFound, redirect } from 'next/navigation';

import { adminAccess } from '@/features/admin/guard';
import { AuthForm } from '@/features/auth/auth-form';

/**
 * Admin sign-in (admin.md): admins go straight in; signed-in non-admins get a plain 404. The admin look (D-096), and
 * still no word naming the admin (D-006).
 */
export default async function AdminLoginPage(): Promise<React.JSX.Element> {
  const access = await adminAccess();
  if (access.state === 'admin') redirect('/admin');
  if (access.state === 'denied') notFound();
  return (
    <main className="font-ui mx-auto max-w-sm px-4 py-20 md:py-28">
      <div className="border-line bg-paper space-y-5 rounded-[18px] border p-6">
        <h1 className="font-heading text-[26px] font-semibold leading-tight">Sign in</h1>
        <AuthForm mode="login" afterSignIn="/admin" links={false} />
      </div>
    </main>
  );
}
