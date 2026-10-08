'use client';

/**
 * The sign-in card's Supabase Auth calls (D-091). The client is loaded on use, not with the page (~66 kB gzipped,
 * engineering.md §Budgets). Each call answers with a customer-ready error line, or null when it worked. The links in
 * Auth's emails come back through /auth/callback, which sets the session and goes on to `after`.
 */
async function auth() {
  const { browserClient } = await import('@/lib/supabase/browser');
  return browserClient().auth;
}

const callback = (after: string): string =>
  `${window.location.origin}/auth/callback?next=${encodeURIComponent(after)}`;

/** Supabase answers "too many requests" with 429; say it plainly. Draft wording (D-091). */
function friendly(
  error: { status?: number; message: string } | null,
  fallback: string,
): string | null {
  if (!error) return null;
  return error.status === 429 ? 'Please wait a minute, then try again.' : fallback;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await (await auth()).signInWithPassword({ email, password });
  return friendly(error, 'Wrong email or password.');
}

/** 'signed-in' when no email confirmation is needed, else 'confirm'; or the error line. */
export async function signUp(
  fullName: string,
  email: string,
  password: string,
  after: string,
): Promise<'signed-in' | 'confirm' | { error: string }> {
  const { data, error } = await (
    await auth()
  ).signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: callback(after) },
  });
  if (error) return { error: friendly(error, error.message) ?? error.message };
  return data.session ? 'signed-in' : 'confirm';
}

/** The reset link, which opens "Set a new password" (/account/password). */
export async function sendReset(email: string): Promise<string | null> {
  const { error } = await (
    await auth()
  ).resetPasswordForEmail(email, { redirectTo: callback('/account/password') });
  return friendly(error, 'We could not send the link. Check the email and try again.');
}

/** A 6-digit code, only to an existing account (no account is made here). */
export async function sendCode(email: string): Promise<string | null> {
  const { error } = await (
    await auth()
  ).signInWithOtp({ email, options: { shouldCreateUser: false } });
  return friendly(
    error,
    'We could not send a code to that email. Is it the one you signed up with?',
  );
}

export async function verifyCode(email: string, code: string): Promise<string | null> {
  const { error } = await (await auth()).verifyOtp({ email, token: code, type: 'email' });
  return friendly(error, "That code didn't work. Check it, or send a new one.");
}

/** "Set a new password", after the reset link signed the customer in. */
export async function setNewPassword(password: string): Promise<string | null> {
  const { error } = await (await auth()).updateUser({ password });
  return friendly(
    error,
    'We could not save it. Open the link from the email again, or ask for a new one.',
  );
}
