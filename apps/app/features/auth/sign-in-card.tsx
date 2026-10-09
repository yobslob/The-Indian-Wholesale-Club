import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import tokens from '@repo/tokens';

import { CodeBoxes, PasswordField } from './fields';

import { Button, ErrorText, Field } from '@/components/ui';
import { API_BASE_URL } from '@/lib/api';
import { supabase } from '@/lib/supabase';


type Step = 'signin' | 'create' | 'created' | 'forgot' | 'forgot-sent' | 'code' | 'code-enter';

/** Supabase answers "too many requests" with 429; say it plainly. Draft wording (D-091), as on the website. */
function friendly(error: { status?: number } | null, fallback: string): string | null {
  if (!error) return null;
  return error.status === 429 ? 'Please wait a minute, then try again.' : fallback;
}

function Link({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Text accessibilityRole="button" onPress={onPress} className="font-ui-semibold text-ink underline">
      {label}
    </Text>
  );
}

/**
 * The sign-in card in the app (D-089, D-091, D-095), the website's card in the app's controls: sign in with an eye on
 * the password, "Forgot password?" (the link opens the website's "Set a new password"), "Email me a sign-in code"
 * (six digits), and Create an account as built. One card for everyone: admin mode is decided by the server after
 * sign-in (lib/session.tsx), never by anything typed here (D-006). `onDone` runs once signed in.
 */
export function SignInCard({
  why = 'To see your orders, saved pieces and addresses.',
  start = 'signin',
  onDone,
}: {
  why?: string;
  start?: 'signin' | 'create';
  onDone?: () => void;
}): React.JSX.Element {
  const [step, setStep] = useState<Step>(start);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = email.trim().toLowerCase();
  const go = (to: Step) => (): void => {
    setError(null);
    setStep(to);
  };

  async function run(call: () => Promise<string | null>, then?: () => void): Promise<void> {
    setBusy(true);
    setError(null);
    const problem = await call();
    setBusy(false);
    if (problem) setError(problem);
    else then?.();
  }
  const sendReset = async (): Promise<string | null> =>
    friendly(
      (await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${API_BASE_URL}/auth/callback?next=/account/password` })).error,
      'We could not send the link. Check the email and try again.',
    );
  const sendCode = async (): Promise<string | null> =>
    friendly(
      (await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } })).error,
      'We could not send a code to that email. Is it the one you signed up with?',
    );

  const submit = (): void => {
    if (step === 'signin') {
      if (!address || password.length < 8) return setError('Enter your email and a password of at least 8 characters.');
      void run(async () => friendly((await supabase.auth.signInWithPassword({ email: address, password })).error, 'Wrong email or password.'), onDone);
    } else if (step === 'create') {
      if (!address || password.length < 8) return setError('Enter your email and a password of at least 8 characters.');
      void run(async () => {
        const { data, error: e } = await supabase.auth.signUp({ email: address, password, options: { data: { full_name: fullName.trim() } } });
        if (e) return friendly(e, e.message);
        if (data.session) onDone?.();
        else setStep('created');
        return null;
      });
    } else if (step === 'forgot') void run(sendReset, go('forgot-sent'));
    else if (step === 'code') void run(sendCode, go('code-enter'));
    else if (step === 'code-enter') {
      void run(async () => friendly((await supabase.auth.verifyOtp({ email: address, token: code, type: 'email' })).error, "That code didn't work. Check it, or send a new one."), onDone);
    }
  };

  const heading = (text: string): React.JSX.Element => (
    <Text accessibilityRole="header" className="font-heading text-[28px] leading-[31px] text-[#1D1A17]">
      {text}
    </Text>
  );
  const lead = (text: React.ReactNode): React.JSX.Element => <Text className="font-body text-ink-muted -mt-1 text-[15px] leading-[22px]">{text}</Text>;
  const emailField = (
    <Field label="Email" value={email} onChangeText={setEmail} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
  );
  const done = (
    <View className="bg-[rgba(22,101,52,0.12)] h-12 w-12 items-center justify-center rounded-full">
      <Ionicons name="checkmark" size={24} color={tokens.colors.positive} />
    </View>
  );

  return (
    <View className="bg-surface gap-4 rounded-lg p-[22px]">
      {step === 'signin' ? (
        <>
          {heading('Sign in')}
          {lead(why)}
          {emailField}
          <PasswordField label="Password" value={password} onChangeText={setPassword} />
          <Pressable accessibilityRole="button" onPress={go('forgot')} className="-mt-2 min-h-8 items-end justify-center">
            <Text className="font-ui text-ink text-[13px] underline">Forgot password?</Text>
          </Pressable>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Sign in" onPress={submit} disabled={busy} />
          <View className="flex-row items-center gap-3">
            <View className="bg-line h-px flex-1" />
            <Text className="font-ui text-ink-muted text-xs">or</Text>
            <View className="bg-line h-px flex-1" />
          </View>
          <Button kind="secondary" label="Email me a sign-in code" onPress={go('code')} />
          <Text className="font-body text-ink-muted text-center text-sm">
            New here? <Link label="Create an account" onPress={go('create')} />
          </Text>
        </>
      ) : step === 'create' ? (
        <>
          {heading('Create an account')}
          {lead('Save pieces and see every order in one place.')}
          <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" />
          {emailField}
          <PasswordField label="Password (8 or more characters)" value={password} onChangeText={setPassword} isNew />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Create account" onPress={submit} disabled={busy} />
          <Text className="font-body text-ink-muted text-center text-sm">
            Already have an account? <Link label="Sign in" onPress={go('signin')} />
          </Text>
        </>
      ) : step === 'created' || step === 'forgot-sent' ? (
        <>
          {done}
          {heading(step === 'created' ? 'Almost there' : 'Check your email')}
          {lead(
            step === 'created' ? (
              'Check your inbox to confirm your email, then sign in.'
            ) : (
              <>
                We sent a reset link to <Text className="font-ui-semibold text-ink">{address}</Text>.
              </>
            ),
          )}
          {error ? <ErrorText>{error}</ErrorText> : null}
          {step === 'forgot-sent' ? <Button kind="secondary" label="Send it again" onPress={() => void run(sendReset)} disabled={busy} /> : null}
          <Text className="font-body text-ink-muted text-center text-sm">
            <Link label="Back to sign in" onPress={go('signin')} />
          </Text>
        </>
      ) : step === 'forgot' || step === 'code' ? (
        <>
          {heading(step === 'forgot' ? 'Forgot password' : 'Sign in with a code')}
          {lead(step === 'forgot' ? "We'll email you a link to set a new one." : "We'll email you a 6-digit code. No password needed.")}
          {emailField}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label={step === 'forgot' ? 'Send reset link' : 'Send code'} onPress={submit} disabled={busy} />
          <Text className="font-body text-ink-muted text-center text-sm">
            <Link label={step === 'forgot' ? 'Back to sign in' : 'Use a password instead'} onPress={go('signin')} />
          </Text>
        </>
      ) : (
        <>
          {heading('Enter the code')}
          {lead(
            <>
              Sent to <Text className="font-ui-semibold text-ink">{address}</Text>.
            </>,
          )}
          <CodeBoxes onChange={setCode} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Sign in" onPress={submit} disabled={busy || code.length !== 6} />
          <Text className="font-body text-ink-muted text-center text-sm">
            <Link label="Resend code" onPress={() => void run(sendCode)} /> · <Link label="Use a password instead" onPress={go('signin')} />
          </Text>
        </>
      )}
    </View>
  );
}
