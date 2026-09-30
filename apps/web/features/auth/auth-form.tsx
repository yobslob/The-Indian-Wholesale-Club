'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { safeNextPath } from '@/lib/site';

const input = 'min-h-12 w-full rounded-md border border-line bg-paper px-3.5 text-[15px] outline-none focus:border-ink';

/**
 * Email + password sign-in / sign-up (Supabase Auth). Used by the customer
 * pages; `afterSignIn` decides where to go next.
 */
export function AuthForm({
  mode,
  next,
  afterSignIn = '/account',
  links = true,
}: {
  mode: 'login' | 'signup';
  next?: string | null;
  afterSignIn?: string;
  /** Sign-up / sign-in links under the form (off on the admin sign-in page). */
  links?: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const destination = safeNextPath(next, afterSignIn);

  async function submit(form: FormData): Promise<void> {
    setBusy(true);
    setError(null);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    // Loaded on submit, not with the page (~66 kB gzipped, engineering.md §Budgets).
    const { browserClient } = await import('@/lib/supabase/browser');
    const supabase = browserClient();
    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('Wrong email or password.');
        setBusy(false);
        return;
      }
      router.replace(destination);
      router.refresh();
      return;
    }
    const fullName = String(form.get('fullName') ?? '').trim();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (data.session) {
      router.replace(destination);
      router.refresh();
    } else {
      setNotice('Check your inbox to confirm your email, then sign in.');
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
      className="grid max-w-sm gap-4"
    >
      {mode === 'signup' ? (
        <label className="font-ui text-ink block text-[13px] font-medium">
          Full name
          <input name="fullName" required autoComplete="name" className={input} />
        </label>
      ) : null}
      <label className="font-ui text-ink block text-[13px] font-medium">
        Email
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="font-ui text-ink block text-[13px] font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className={input}
        />
      </label>
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-positive text-sm" role="status">
          {notice}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] font-medium disabled:opacity-50"
      >
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      {!links ? null : mode === 'login' ? (
        <p className="text-ink-muted text-sm">
          New here?{' '}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="underline"
          >
            Create an account
          </Link>
        </p>
      ) : (
        <p className="text-ink-muted text-sm">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}
