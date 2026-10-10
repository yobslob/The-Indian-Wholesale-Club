'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { addPhoto, newSubmission, submitPiece } from '@repo/db/vendor';
import { pieceFormSchema, t, toSubmitDetails, uploadPath, viewsNeeded, type Language, type Wears } from '@repo/shared/vendor';

import { browserClient } from '@/lib/supabase/browser';

import { ChooseStep, type Category } from './choose-step';
import { DetailsStep, type Details } from './details-step';
import { Icon } from './icons';
import { sendPhoto } from './photo';
import { PhotoStep, type Shot } from './photo-step';

/** A piece being retaken: what it already has (D-103). */
export type Existing = {
  id: string;
  category: Category;
  wears: Wears | null;
  photos: Partial<Record<'front' | 'back' | 'closeup', string>>;
  details: Details;
};

const EMPTY: Details = { sizes: [], price: '', fabric: '', care: '', colour: '', note: '' };

/**
 * Adding a piece (D-103), one job per screen: what it is and who wears it → front, back and close-up photos (each
 * checked at once and sent as soon as it is taken) → sizes and price → Send. Also retakes a piece IWC asked about.
 * Everything goes through the vendor_* functions as the vendor (INV-10).
 */
export function NewPiece({
  lang,
  vendorId,
  categories,
  existing,
}: {
  lang: Language;
  vendorId: string;
  categories: Category[];
  existing?: Existing;
}): React.JSX.Element {
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(existing?.category ?? null);
  const [wears, setWears] = useState<Wears | null>(existing?.wears ?? null);
  const [id, setId] = useState<string | null>(existing?.id ?? null);
  const [step, setStep] = useState(existing ? 1 : 0);          // 0 choose · 1..n photos · n+1 details · n+2 sent
  const [details, setDetails] = useState<Details>(existing?.details ?? EMPTY);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const views = viewsNeeded(category?.product_type ?? 'clothing');
  const client = browserClient();
  const canChoose = category !== null && (category.product_type === 'spice' || wears !== null);

  async function photoTaken(view: (typeof views)[number], shot: Shot | null): Promise<void> {
    setError(false);
    if (shot) {
      try {
        setProgress(0);
        const submission = id ?? (await newSubmission(client, category?.product_type ?? 'clothing'));
        setId(submission);
        const path = uploadPath(vendorId, submission, view, Date.now());
        await sendPhoto(shot.blob, path, setProgress);
        await addPhoto(client, { submissionId: submission, view, path, checks: shot.checks });
      } catch {
        setError(true);
        setProgress(null);
        return;
      } finally {
        URL.revokeObjectURL(shot.preview);
      }
    }
    setProgress(null);
    setStep((s) => s + 1);
  }

  function startAgain(): void {
    if (existing) {
      router.push('/vendor/new');
      return;
    }
    setCategory(null);
    setWears(null);
    setId(null);
    setDetails(EMPTY);
    setStep(0);
  }

  async function send(): Promise<void> {
    setError(false);
    const form = pieceFormSchema.safeParse({
      category_id: category?.id,
      wears: wears ?? 'unisex',
      fabric: details.fabric,
      care: details.care,
      colour: details.colour,
      note: details.note,
      price_rupees: details.price,
      sizes: details.sizes,
    });
    if (!form.success || !id) {
      setError(true);
      return;
    }
    try {
      setProgress(1);
      await submitPiece(client, id, toSubmitDetails(form.data));
      setStep(views.length + 2);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setProgress(null);
    }
  }

  if (step === views.length + 2) {
    return (
      <section className="space-y-4 py-6 text-center">
        <span className="bg-positive/15 text-positive mx-auto flex h-20 w-20 items-center justify-center rounded-full"><Icon name="check" className="h-10 w-10" /></span>
        <h2 className="font-heading text-[26px] font-semibold">{t(lang, 'sent_title')}</h2>
        <p className="text-[17px]">{t(lang, 'sent_body')}</p>
        <button type="button" onClick={startAgain} className="bg-brand text-on-brand flex min-h-14 w-full items-center justify-center rounded-[14px] text-[17px] font-semibold">{t(lang, 'add_another')}</button>
        <Link href="/vendor/pieces" className="text-ink block min-h-12 py-3 underline">{t(lang, 'my_pieces')}</Link>
      </section>
    );
  }

  const photoIndex = step - 1;
  const view = views[photoIndex];
  const valid = pieceFormSchema.safeParse({ category_id: category?.id, wears: wears ?? 'unisex', price_rupees: details.price, sizes: details.sizes }).success;

  return (
    <div className="space-y-5">
      {step === 0 ? (
        <ChooseStep lang={lang} categories={categories} category={category} wears={wears} onCategory={(c) => { setCategory(c); if (c.product_type === 'spice') setWears(null); }} onWears={setWears} />
      ) : view ? (
        <PhotoStep key={view} lang={lang} view={view} step={step} total={views.length + 1} existing={existing?.photos[view] ?? null} onShot={(shot) => void photoTaken(view, shot)} />
      ) : (
        <DetailsStep lang={lang} value={details} onChange={setDetails} />
      )}

      {progress !== null ? (
        <div role="status" className="space-y-1">
          <p className="text-ink-muted text-[14px]">{t(lang, 'sending')}</p>
          <div className="bg-line h-2 overflow-hidden rounded-full"><div className="bg-brand h-full transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-danger text-[15px] font-semibold">{t(lang, 'send_failed')}</p> : null}

      <div className="flex gap-2">
        {step > 0 && !(existing && step === 1) ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="border-line inline-flex min-h-14 items-center gap-1 rounded-[14px] border px-4 text-[15px]">
            <Icon name="back" className="h-5 w-5" /> {t(lang, 'back')}
          </button>
        ) : null}
        {step === 0 ? (
          <button type="button" disabled={!canChoose} onClick={() => setStep(1)} className="bg-ink text-paper min-h-14 flex-1 rounded-[14px] text-[17px] font-semibold disabled:opacity-40">{t(lang, 'next')}</button>
        ) : !view ? (
          <button type="button" disabled={!valid || progress !== null} onClick={() => void send()} className="bg-brand text-on-brand min-h-14 flex-1 rounded-[14px] text-[18px] font-semibold disabled:opacity-40">{t(lang, 'send')}</button>
        ) : null}
      </div>
    </div>
  );
}
