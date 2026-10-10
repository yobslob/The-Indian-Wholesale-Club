'use client';

import { useRef, useState } from 'react';

import { t, type Language, type PhotoChecks, type PhotoView } from '@repo/shared/vendor';

import { Icon } from './icons';
import { readPhoto } from './photo';

const SHOOT = { front: 'shoot_front', back: 'shoot_back', closeup: 'shoot_closeup' } as const;
const VIEW = { front: 'view_front', back: 'view_back', closeup: 'view_closeup' } as const;
const ISSUE = { small: 'check_small', dark: 'check_dark', bright: 'check_bright', blurry: 'check_blurry' } as const;

/** The outline to follow: a garment for front and back, a magnifier circle for the close-up. */
function Guide({ view }: { view: PhotoView }): React.JSX.Element {
  return (
    <svg viewBox="0 0 120 150" aria-hidden="true" className="text-ink-muted mx-auto h-40 w-32 fill-none stroke-current stroke-[1.5] [stroke-dasharray:4_4]">
      {view === 'closeup' ? (
        <circle cx="60" cy="72" r="46" />
      ) : (
        <path d="M42 10l-30 22 12 16 10-6v98h52V42l10 6 12-16-30-22c-4 9-10 13-18 13s-14-4-18-13z" />
      )}
    </svg>
  );
}

export type Shot = { blob: Blob; checks: PhotoChecks; preview: string };

/**
 * One photo (D-103): the outline and words, a big Take photo button (opens the phone's camera), then the instant check.
 * A good photo goes on by itself; a weak one asks to take it again, and can still be used.
 */
export function PhotoStep({
  lang,
  view,
  step,
  total,
  existing,
  onShot,
}: {
  lang: Language;
  view: PhotoView;
  step: number;
  total: number;
  existing?: string | null;
  /** A new photo, or null to keep the photo this piece already has (a retake of other views). */
  onShot: (shot: Shot | null) => void;
}): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function chosen(file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const next = await readPhoto(file);
      if (next.checks.issues.length === 0) onShot(next);
      else setShot(next);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-ink-muted text-[13px] font-semibold">{t(lang, 'step_of', { n: step, total })}</p>
      <h2 className="font-heading text-[22px] font-semibold">{t(lang, VIEW[view])}</h2>
      {shot ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob URL), never a stored photo */}
          <img src={shot.preview} alt="" className="border-line mx-auto max-h-[46vh] rounded-[14px] border object-contain" />
          <ul className="space-y-1.5" role="status">
            {shot.checks.issues.map((issue) => (
              <li key={issue} className="text-danger flex items-start gap-2 text-[15px] font-semibold">
                <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                {t(lang, ISSUE[issue])}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => input.current?.click()} className="bg-ink text-paper flex min-h-14 w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold">
            <Icon name="camera" /> {t(lang, 'retake')}
          </button>
          <button type="button" onClick={() => onShot(shot)} className="border-line text-ink min-h-12 w-full rounded-[14px] border text-[15px]">
            {t(lang, 'next')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-line bg-paper rounded-[18px] border border-dashed p-5 text-center">
            {existing ? (
              // eslint-disable-next-line @next/next/no-img-element -- the vendor's own photo (signed URL)
              <img src={existing} alt="" className="mx-auto mb-3 max-h-40 rounded-[10px] object-contain" />
            ) : (
              <Guide view={view} />
            )}
            <p className="mt-3 text-[17px] leading-snug">{t(lang, SHOOT[view])}</p>
            <p className="text-ink-muted mt-2 text-[13px]">{t(lang, 'tips')}</p>
            {view === 'front' ? <p className="text-ink-muted mt-1 text-[13px]">{t(lang, 'set_tip')}</p> : null}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="bg-brand text-on-brand flex min-h-16 w-full items-center justify-center gap-2 rounded-[16px] text-[19px] font-semibold disabled:opacity-60"
          >
            <Icon name="camera" className="h-7 w-7" /> {busy ? '…' : t(lang, existing ? 'retake' : 'take_photo')}
          </button>
          {existing ? (
            <button type="button" onClick={() => onShot(null)} className="border-line text-ink min-h-12 w-full rounded-[14px] border text-[15px]">
              {t(lang, 'next')}
            </button>
          ) : null}
          {error ? <p className="text-danger text-[15px]">{t(lang, 'try_again')}</p> : null}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => void chosen(e.target.files?.[0])} />
    </section>
  );
}
