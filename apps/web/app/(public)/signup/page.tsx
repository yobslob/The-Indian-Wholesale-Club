import { SignupFormContainer } from '@/components/auth/signup-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account - ROOT',
  description: 'Create a ROOT account to track orders and save your details.',
  robots: { index: false },
};

export default function SignupPage(): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Create your ROOT account
        </h1>
        <p className="mt-2 text-xs text-neutral-500">
          Track orders, save addresses and get first access to new drops.
        </p>
      </div>

      <div className="mt-8">
        <SignupFormContainer />
      </div>
    </div>
  );
}
