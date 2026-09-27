'use client';

import { ArrowRight, CheckCircle2, Lock, Mail, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

function SignupForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';
  const initialEmail = searchParams.get('email') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) throw error;

      if (data.session) {
        // Email confirmation disabled - already signed in
        router.push(redirectTo);
        router.refresh();
        return;
      }

      // Email confirmation required (H6)
      setVerificationSent(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Account created. We sent a verification link to <strong>{email}</strong> - open it to
            activate your account, then sign in.
          </span>
        </div>
        <div className="mt-6">
          <Link
            href="/login"
            className="bg-neutral-900 hover:bg-neutral-800 flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold text-white transition-colors"
          >
            <span>Go to Sign In</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      {errorMsg && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="block text-xs font-semibold text-neutral-700">
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Morgan"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-xs focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="signup-email" className="block text-xs font-semibold text-neutral-700">
            Email Address
          </label>
          <div className="relative mt-1">
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 pl-9 text-xs focus:border-neutral-900 focus:outline-none"
            />
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          </div>
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-xs font-semibold text-neutral-700">
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 pl-9 text-xs focus:border-neutral-900 focus:outline-none"
            />
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-neutral-900 hover:bg-neutral-800 mt-2 flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 border-t border-neutral-100 pt-6 text-center text-xs text-neutral-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-neutral-900 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function SignupFormContainer(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
