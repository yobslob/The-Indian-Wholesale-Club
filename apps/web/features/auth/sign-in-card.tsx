'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { sendCode, sendReset, signIn, signUp, verifyCode } from './auth-client';
import {
  CodeBoxes,
  Check,
  EmailField,
  field,
  input,
  linkButton,
  PasswordField,
  primary,
  secondary,
} from './fields';

type Step = 'signin' | 'create' | 'created' | 'forgot' | 'forgot-sent' | 'code' | 'code-enter';

/**
 * The sign-in card (D-089, D-091): on the profile page when signed out, and centred on /login and /signup. Sign in with
 * email and password (an eye shows the password), "Forgot password?" (a reset link by email, back through
 * /auth/callback to "Set a new password"), "Email me a sign-in code" (six digits, no password), and Create an account
 * as built. After signing in it goes to `next`, or stays where it is and shows what the visitor came for.
 */
export function SignInCard({
  start = 'signin',
  next = null,
}: {
  start?: 'signin' | 'create';
  next?: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>(start);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (to: Step) => (): void => {
    setError(null);
    setStep(to);
  };
  const done = (): void => {
    if (next) router.replace(next);
    router.refresh();
  };

  /** Runs one Auth call: busy while it runs, its error line shown; `then` only when it worked. */
  async function run(call: () => Promise<string | null>, then?: () => void): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const problem = await call();
      if (problem) setError(problem);
      else then?.();
    } finally {
      setBusy(false);
    }
  }

  function submit(form: FormData): void {
    const text = (k: string): string => String(form.get(k) ?? '').trim();
    const address = text('email') || email;
    const password = String(form.get('password') ?? '');
    setEmail(address);
    if (step === 'signin') void run(() => signIn(address, password), done);
    else if (step === 'forgot') void run(() => sendReset(address), go('forgot-sent'));
    else if (step === 'code') void run(() => sendCode(address), go('code-enter'));
    else if (step === 'code-enter') void run(() => verifyCode(address, code), done);
    else if (step === 'create') {
      void run(async () => {
        const result = await signUp(text('fullName'), address, password, next ?? '/account');
        if (typeof result === 'object') return result.error;
        if (result === 'signed-in') done();
        else setStep('created');
        return null;
      });
    }
  }

  const heading = (text: string): React.JSX.Element => (
    <h1 className="font-heading m-0 mb-1.5 text-[clamp(28px,2.6vw,40px)] font-medium leading-[1.1] tracking-[-0.02em] text-[#1D1A17]">
      {text}
    </h1>
  );
  const lead = (content: React.ReactNode): React.JSX.Element => (
    <p className="text-ink-muted font-body mb-5 text-[15px]">{content}</p>
  );
  const alt = (content: React.ReactNode): React.JSX.Element => (
    <p className="text-ink-muted font-body mt-4 text-center text-sm">{content}</p>
  );
  const errorLine = error ? (
    <p className="text-danger mb-3 text-sm" role="alert">
      {error}
    </p>
  ) : null;

  return (
    <div className="grid place-items-center py-[clamp(16px,4vw,64px)]">
      <form
        noValidate={step === 'code-enter'}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        className="bg-surface w-full max-w-[440px] rounded-lg p-[clamp(24px,3vw,36px)]"
      >
        {step === 'signin' ? (
          <>
            {heading('Sign in')}
            {lead('To see your orders, saved pieces and addresses.')}
            <EmailField value={email} />
            <PasswordField label="Password" name="password" autoComplete="current-password" />
            <button
              type="button"
              onClick={go('forgot')}
              className="font-ui -mt-1.5 mb-4 ml-auto block min-h-7 text-[13px] font-medium underline underline-offset-[3px]"
            >
              Forgot password?
            </button>
            {errorLine}
            <button type="submit" disabled={busy} className={primary}>
              Sign in
            </button>
            <p className="font-ui text-ink-muted before:bg-line after:bg-line my-4 mb-1.5 flex items-center gap-3 text-xs font-medium before:h-px before:flex-1 after:h-px after:flex-1">
              or
            </p>
            <button type="button" onClick={go('code')} className={secondary}>
              Email me a sign-in code
            </button>
            {alt(
              <>
                New here?{' '}
                <button type="button" onClick={go('create')} className={linkButton}>
                  Create an account
                </button>
              </>,
            )}
          </>
        ) : step === 'create' ? (
          <>
            {heading('Create an account')}
            {lead('Save pieces and see every order in one place.')}
            <label className={field}>
              Full name
              <input name="fullName" required autoComplete="name" className={input} />
            </label>
            <EmailField value={email} />
            <PasswordField
              label="Password (8 or more characters)"
              name="password"
              autoComplete="new-password"
            />
            {errorLine}
            <button type="submit" disabled={busy} className={primary}>
              Create account
            </button>
            {alt(
              <>
                Already have an account?{' '}
                <button type="button" onClick={go('signin')} className={linkButton}>
                  Sign in
                </button>
              </>,
            )}
          </>
        ) : step === 'created' ? (
          <>
            <Check />
            {heading('Almost there')}
            {lead('Check your inbox to confirm your email, then sign in.')}
            {alt(
              <button type="button" onClick={go('signin')} className={linkButton}>
                Back to sign in
              </button>,
            )}
          </>
        ) : step === 'forgot' ? (
          <>
            {heading('Forgot password')}
            {lead("We'll email you a link to set a new one.")}
            <EmailField value={email} />
            {errorLine}
            <button type="submit" disabled={busy} className={primary}>
              Send reset link
            </button>
            {alt(
              <button type="button" onClick={go('signin')} className={linkButton}>
                Back to sign in
              </button>,
            )}
          </>
        ) : step === 'forgot-sent' ? (
          <>
            <Check />
            {heading('Check your email')}
            {lead(
              <>
                We sent a reset link to <b className="font-semibold text-black">{email}</b>.
              </>,
            )}
            {errorLine}
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => sendReset(email))}
              className={secondary}
            >
              Send it again
            </button>
            {alt(
              <button type="button" onClick={go('signin')} className={linkButton}>
                Back to sign in
              </button>,
            )}
          </>
        ) : step === 'code' ? (
          <>
            {heading('Sign in with a code')}
            {lead("We'll email you a 6-digit code. No password needed.")}
            <EmailField value={email} />
            {errorLine}
            <button type="submit" disabled={busy} className={primary}>
              Send code
            </button>
            {alt(
              <button type="button" onClick={go('signin')} className={linkButton}>
                Use a password instead
              </button>,
            )}
          </>
        ) : (
          <>
            {heading('Enter the code')}
            {lead(
              <>
                Sent to <b className="font-semibold text-black">{email}</b>.
              </>,
            )}
            <CodeBoxes onChange={setCode} />
            {errorLine}
            <button type="submit" disabled={busy || code.length !== 6} className={primary}>
              Sign in
            </button>
            {alt(
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => sendCode(email))}
                  className={linkButton}
                >
                  Resend code
                </button>
                {' · '}
                <button type="button" onClick={go('signin')} className={linkButton}>
                  Use a password instead
                </button>
              </>,
            )}
          </>
        )}
      </form>
    </div>
  );
}
