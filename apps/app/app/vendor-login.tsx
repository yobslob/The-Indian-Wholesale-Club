import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { t } from '@repo/shared/vendor';

import { Body, Button, ErrorText, Field, Screen } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/**
 * A shop's sign-in in the app (D-102): opened by IWC's app link (`iwc://vendor-login?code=…`, from the admin's QR card)
 * or with the code typed. The website's server redeems the code once (D-043: it holds the secret) and hands back a token
 * that becomes the session here. Never linked from a customer screen (D-003).
 */
export default function VendorLoginScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'bad'>('idle');
  const tried = useRef(false);

  async function signIn(value: string): Promise<void> {
    if (!value.trim()) return;
    setState('busy');
    const res = await apiPost<{ tokenHash: string }>('/vendor/api/sign-in', { code: value.trim() });
    if (!res.ok) return setState('bad');
    const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: res.data.tokenHash });
    if (error) return setState('bad');
    router.replace('/vendor');
  }

  useEffect(() => {
    if (params.code && !tried.current) {
      tried.current = true;
      void signIn(params.code);
    }
    // Once, on arrival with a code.
  }, []);

  return (
    <Screen title={t('hi', 'login_title')}>
      <Body>{t('hi', 'login_scan')}</Body>
      <Body muted>{t('en', 'login_scan')}</Body>
      <Field label={`${t('hi', 'login_code')} / ${t('en', 'login_code')}`} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
      <Button label={state === 'busy' ? '…' : t('hi', 'login_go')} disabled={state === 'busy'} onPress={() => void signIn(code)} />
      {state === 'bad' ? <ErrorText>{`${t('hi', 'login_bad')} · ${t('en', 'login_bad')}`}</ErrorText> : null}
    </Screen>
  );
}
