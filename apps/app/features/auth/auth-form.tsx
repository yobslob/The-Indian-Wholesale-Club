import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, ErrorText, Field } from '@/components/ui';
import { supabase } from '@/lib/supabase';

/**
 * Email + password sign-in / sign-up (Supabase Auth), the same rules as the
 * website's form. One form for everyone: admin mode is decided by the server
 * after sign-in (lib/session.tsx), never by anything typed here (D-006).
 */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }): React.JSX.Element {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function done(): void {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  }

  async function submit(): Promise<void> {
    setError(null);
    setNotice(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 8) {
      setError('Enter your email and a password of at least 8 characters.');
      return;
    }
    setBusy(true);
    if (mode === 'login') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      setBusy(false);
      if (authError) setError('Wrong email or password.');
      else done();
      return;
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else if (data.session) done();
    else setNotice('Check your inbox to confirm your email, then sign in.');
  }

  return (
    <>
      {mode === 'signup' ? (
        <Field
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          autoComplete="name"
          textContentType="name"
        />
      ) : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        textContentType={mode === 'login' ? 'password' : 'newPassword'}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {notice ? <Text className="text-positive text-sm">{notice}</Text> : null}
      <Button
        label={mode === 'login' ? 'Sign in' : 'Create account'}
        onPress={() => void submit()}
        disabled={busy}
      />
      {mode === 'login' ? (
        <Button
          kind="link"
          label="New here? Create an account"
          onPress={() => router.replace('/auth/signup')}
        />
      ) : (
        <Button
          kind="link"
          label="Already have an account? Sign in"
          onPress={() => router.replace('/auth/login')}
        />
      )}
    </>
  );
}
