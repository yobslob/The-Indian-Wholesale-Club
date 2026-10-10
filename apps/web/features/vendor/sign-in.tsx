'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { t, type Language } from '@repo/shared/vendor';

import { browserClient } from '@/lib/supabase/browser';

/**
 * Vendor sign-in (D-102): the QR code or link IWC gives a shop carries a one-time code; opening it signs the phone in
 * by itself. The code can also be typed. The server redeems it (once, rate-limited) and hands back a token that
 * becomes the session here; no password, no SMS.
 */
export function VendorSignIn({ lang, initialCode }: { lang: Language; initialCode: string }): React.JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<'idle' | 'busy' | 'bad'>('idle');
  const tried = useRef(false);

  async function signIn(value: string): Promise<void> {
    if (!value.trim()) return;
    setState('busy');
    try {
      const res = await fetch('/vendor/api/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: value.trim() }),
      });
      const body = (await res.json()) as { tokenHash?: string };
      if (!res.ok || !body.tokenHash) throw new Error('bad');
      const { error } = await browserClient().auth.verifyOtp({ type: 'magiclink', token_hash: body.tokenHash });
      if (error) throw error;
      router.replace('/vendor');
      router.refresh();
    } catch {
      setState('bad');
    }
  }

  useEffect(() => {
    if (initialCode && !tried.current) {
      tried.current = true;
      // The code leaves the address bar at once, so it is not kept in the phone's history.
      window.history.replaceState(null, '', '/vendor/login');
      void signIn(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival with a code
  }, []);

  return (
    <div className="space-y-5">
      <p className="text-[17px] leading-snug">{t(lang, 'login_scan')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(code);
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="text-ink-muted mb-1 block text-[14px]">{t(lang, 'login_code')}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            className="border-line bg-paper min-h-12 w-full rounded-[12px] border px-3 text-[16px]"
          />
        </label>
        <button disabled={state === 'busy'} className="bg-brand text-on-brand min-h-14 w-full rounded-[14px] text-[17px] font-semibold disabled:opacity-60">
          {state === 'busy' ? '…' : t(lang, 'login_go')}
        </button>
        {state === 'bad' ? <p role="alert" className="text-danger text-[15px] font-semibold">{t(lang, 'login_bad')}</p> : null}
      </form>
      <p className="pt-6 text-center">
        <Link href="/vendor/join" className="text-ink-muted text-[14px] underline">{t(lang, 'join_q')}</Link>
      </p>
    </div>
  );
}
