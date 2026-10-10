'use client';

import { useState, useTransition } from 'react';

import { LANGUAGE_CODES, LANGUAGES } from '@repo/shared/vendor';

import { createVendorAccountAction, newSignInCodeAction, setVendorAccountActiveAction, type SignInCode } from './actions/vendor-accounts';
import { input, secondaryButton } from './styles';

/** The QR and link, shown once (D-102): scan it in the shop, or send the link on WhatsApp. */
function CodeCard({ code, onClose }: { code: SignInCode; onClose: () => void }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-line bg-canvas mt-2 space-y-2 rounded-[12px] border p-3">
      {/* The SVG is made on our server by the qrcode package from our own link. */}
      <div className="mx-auto w-44" dangerouslySetInnerHTML={{ __html: code.qr }} />
      <p className="text-ink-muted break-all text-[12px]">{code.link}</p>
      <p className="text-ink-muted text-[12px]">Works once, for {code.expiresDays} days. Shown only now.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryButton} onClick={() => void navigator.clipboard.writeText(code.link).then(() => setCopied(true))}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a className={secondaryButton} href={`https://wa.me/?text=${encodeURIComponent(code.link)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>
        <button type="button" className={secondaryButton} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

/** A shop's vendor accounts (D-102): make one, give a new code, switch one off. */
export function VendorAccess({
  vendorId,
  defaultLanguage,
  accounts,
}: {
  vendorId: string;
  defaultLanguage: string;
  accounts: { user_id: string; language: string; is_active: boolean; last_seen_at: string | null }[];
}): React.JSX.Element {
  const [lang, setLang] = useState(defaultLanguage);
  const [code, setCode] = useState<SignInCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (job: () => Promise<SignInCode | void>): void =>
    start(async () => {
      setError(null);
      try {
        const result = await job();
        if (result) setCode(result);
      } catch {
        setError('Could not do that. Try again.');
      }
    });

  return (
    <div className="space-y-1.5">
      {accounts.map((a, i) => (
        <div key={a.user_id} className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className={a.is_active ? '' : 'text-ink-muted line-through'}>Account {i + 1} · {LANGUAGES[a.language as keyof typeof LANGUAGES]?.name ?? a.language}</span>
          <span className="text-ink-muted">{a.last_seen_at ? `signed in ${new Date(a.last_seen_at).toLocaleDateString()}` : 'not signed in yet'}</span>
          {a.is_active ? (
            <button type="button" disabled={pending} className="underline" onClick={() => run(() => newSignInCodeAction(a.user_id, 7))}>New code</button>
          ) : null}
          <button type="button" disabled={pending} className="text-ink-muted underline" onClick={() => run(() => setVendorAccountActiveAction(a.user_id, !a.is_active))}>
            {a.is_active ? 'Switch off' : 'Switch on'}
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <select value={lang} onChange={(e) => setLang(e.target.value)} className={`${input} max-w-[150px]`} aria-label="Screens’ language">
          {LANGUAGE_CODES.map((c) => <option key={c} value={c}>{LANGUAGES[c].name}</option>)}
        </select>
        <button type="button" disabled={pending} className={secondaryButton} onClick={() => run(() => createVendorAccountAction(vendorId, lang))}>
          New account
        </button>
      </div>
      {error ? <p className="text-danger text-[13px]">{error}</p> : null}
      {code ? <CodeCard code={code} onClose={() => setCode(null)} /> : null}
    </div>
  );
}
