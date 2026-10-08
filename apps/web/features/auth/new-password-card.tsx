'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { setNewPassword } from './auth-client';
import { PasswordField, primary } from './fields';

/** "Set a new password" (D-091), opened by the reset link once /auth/callback has signed the customer in. */
export function NewPasswordCard(): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid place-items-center py-[clamp(16px,4vw,64px)]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const password = String(form.get('password') ?? '');
          if (password !== String(form.get('again') ?? '')) {
            setError("The two don't match. Type the same password twice.");
            return;
          }
          setBusy(true);
          setError(null);
          void setNewPassword(password).then((problem) => {
            setBusy(false);
            if (problem) setError(problem);
            else {
              router.replace('/account');
              router.refresh();
            }
          });
        }}
        className="bg-surface w-full max-w-[440px] rounded-lg p-[clamp(24px,3vw,36px)]"
      >
        <h1 className="font-heading m-0 mb-1.5 text-[clamp(28px,2.6vw,40px)] font-medium leading-[1.1] tracking-[-0.02em] text-[#1D1A17]">
          Set a new password
        </h1>
        <p className="text-ink-muted font-body mb-5 text-[15px]">At least 8 characters.</p>
        <PasswordField label="New password" name="password" autoComplete="new-password" />
        <PasswordField label="Type it again" name="again" autoComplete="new-password" />
        {error ? (
          <p className="text-danger mb-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={primary}>
          Save and sign in
        </button>
      </form>
    </div>
  );
}
