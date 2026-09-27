'use client';

import { ArrowRight, CheckCircle2, Lock, Mail, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        setSuccessMsg('Account created successfully! You can now sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemoAdmin = (): void => {
    setEmail('admin@root.com');
    setPassword('RootAdmin2026!');
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {isSignUp ? 'Create your ROOT account' : 'Sign in to ROOT'}
        </h1>
        <p className="mt-2 text-xs text-neutral-500">
          {isSignUp
            ? 'Already have an account? '
            : "Don't have an account yet? "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="font-semibold text-neutral-900 underline underline-offset-4 hover:text-neutral-700"
          >
            {isSignUp ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        {errorMsg && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-xs focus:border-neutral-900 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700">Email Address</label>
            <div className="relative mt-1">
              <input
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
            <label className="block text-xs font-semibold text-neutral-700">Password</label>
            <div className="relative mt-1">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 pl-9 text-xs focus:border-neutral-900 focus:outline-none"
              />
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-neutral-100 pt-6">
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-center">
            <span className="text-[11px] text-neutral-500">Need admin dashboard access?</span>
            <button
              type="button"
              onClick={handleFillDemoAdmin}
              className="mt-1 block w-full text-xs font-medium text-neutral-700 underline hover:text-neutral-900"
            >
              Prefill Admin Demo Credentials
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-neutral-400">
        <Link href="/" className="hover:text-neutral-600">
          ← Return to Storefront
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
