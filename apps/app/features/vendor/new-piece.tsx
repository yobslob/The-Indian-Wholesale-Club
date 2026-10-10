import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { addPhoto, newSubmission, submitPiece } from '@repo/db/vendor';
import { pieceFormSchema, toSubmitDetails, uploadPath, viewsNeeded, type Wears } from '@repo/shared/vendor';

import { useVendor } from './context';
import { sendVendorPhoto, takeVendorPhoto, type TakenPhoto } from './photo';
import { ChooseStep, DetailsStep, PhotoStep, type Category, type Details } from './steps';

import { Button, ErrorText } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { clearQueryCache } from '@/lib/use-query';


export type Existing = { id: string; category: Category; wears: Wears | null; photos: Partial<Record<'front' | 'back' | 'closeup', string>>; details: Details };
const EMPTY: Details = { sizes: [], price: '', fabric: '', care: '', colour: '', note: '' };

/**
 * Adding a piece in the app (D-103), the same steps as the website: what it is and who wears it → front, back and
 * close-up (each checked at once and sent as soon as it is used) → sizes and price → Send. Also retakes.
 */
export function NewPiece({ vendorId, categories, existing }: { vendorId: string; categories: Category[]; existing?: Existing }): React.JSX.Element {
  const { w } = useVendor();
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(existing?.category ?? null);
  const [wears, setWears] = useState<Wears | null>(existing?.wears ?? null);
  const [id, setId] = useState<string | null>(existing?.id ?? null);
  const [step, setStep] = useState(existing ? 1 : 0);
  const [shot, setShot] = useState<TakenPhoto | null>(null);
  const [details, setDetails] = useState<Details>(existing?.details ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const views = viewsNeeded(category?.product_type ?? 'clothing');
  const view = views[step - 1];

  async function take(source: 'camera' | 'library'): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const result = await takeVendorPhoto(source);
      if (result === 'denied') setError(w('try_again'));
      else if (result) setShot(result);
    } catch {
      setError(w('try_again'));
    } finally {
      setBusy(false);
    }
  }

  async function use(): Promise<void> {
    if (!view) return;
    setError(null);
    if (shot) {
      setBusy(true);
      try {
        const submission = id ?? (await newSubmission(supabase, category?.product_type ?? 'clothing'));
        setId(submission);
        const path = uploadPath(vendorId, submission, view, Date.now());
        await sendVendorPhoto(shot.uri, path);
        await addPhoto(supabase, { submissionId: submission, view, path, checks: shot.checks });
      } catch {
        setError(w('send_failed'));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setShot(null);
    setStep((s) => s + 1);
  }

  async function send(): Promise<void> {
    const form = pieceFormSchema.safeParse({ category_id: category?.id, wears: wears ?? 'unisex', ...details, price_rupees: details.price });
    if (!form.success || !id) return setError(w('try_again'));
    setBusy(true);
    try {
      await submitPiece(supabase, id, toSubmitDetails(form.data));
      clearQueryCache();
      setStep(views.length + 2);
    } catch {
      setError(w('send_failed'));
    } finally {
      setBusy(false);
    }
  }

  if (step === views.length + 2) {
    return (
      <View className="items-center gap-4 py-6">
        <Text className="font-heading text-ink text-[26px]">{w('sent_title')}</Text>
        <Text className="font-body text-ink text-center text-[17px]">{w('sent_body')}</Text>
        <Button label={w('add_another')} onPress={() => (existing ? router.replace('/vendor/new') : (setCategory(null), setWears(null), setId(null), setDetails(EMPTY), setStep(0)))} />
        <Button kind="link" label={w('my_pieces')} onPress={() => router.replace('/vendor/pieces')} />
      </View>
    );
  }

  const valid = pieceFormSchema.safeParse({ category_id: category?.id, wears: wears ?? 'unisex', price_rupees: details.price, sizes: details.sizes }).success;
  return (
    <View className="gap-5">
      {step === 0 ? (
        <ChooseStep categories={categories} category={category} wears={wears} onCategory={(c) => { setCategory(c); if (c.product_type === 'spice') setWears(null); }} onWears={setWears} />
      ) : view ? (
        <PhotoStep view={view} step={step} total={views.length + 1} shot={shot} existing={existing?.photos[view]} busy={busy} onTake={(s) => void take(s)} onUse={() => void use()} />
      ) : (
        <DetailsStep value={details} onChange={setDetails} />
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {step === 0 ? <Button label={w('next')} disabled={!category || (category.product_type === 'clothing' && !wears)} onPress={() => setStep(1)} /> : null}
      {step > views.length ? <Button label={busy ? w('sending') : w('send')} disabled={!valid || busy} onPress={() => void send()} /> : null}
      {step > 0 && !(existing && step === 1) ? <Button kind="link" label={w('back')} onPress={() => { setShot(null); setStep((s) => s - 1); }} /> : null}
    </View>
  );
}
