import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addReviewPhoto, createReview, getMyProfile, getReviewableProduct, getReviewEligibility } from '@repo/db/account';
import tokens from '@repo/tokens';

import { Photo } from '@/components/photo';
import { Button, ErrorText, Loading } from '@/components/ui';
import { SignInCard } from '@/features/auth/sign-in-card';
import { shrink, sniff } from '@/lib/photo-files';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** As on the website (apps/web/features/reviews/limits.ts, D-056). */
const MAX_PHOTOS = 4;
const label = 'font-ui-semibold text-ink-muted mb-2 text-[11px] uppercase tracking-[1.8px]';
const box = 'border-line bg-paper text-ink font-body rounded-md border px-3 py-2.5 text-[15px]';

type Piece = NonNullable<Awaited<ReturnType<typeof getReviewableProduct>>>;
interface Ready {
  piece: Piece;
  verified: boolean;
  reviewed: boolean;
  displayName: string;
}

function Form({ productId, ready }: { productId: string; ready: Ready }): React.JSX.Element {
  const { session } = useSession();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [name, setName] = useState(ready.displayName);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(ready.reviewed ? `You have already reviewed ${ready.piece.name}.` : null);

  async function addPhotos(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError('Allow photo access in Settings to add photos.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length, quality: 1 });
    if (result.canceled) return;
    const small = await Promise.all(result.assets.map((a) => shrink(a, 1600)));
    setPhotos((all) => [...all, ...small.map((s) => s.uri)].slice(0, MAX_PHOTOS));
  }

  async function send(): Promise<void> {
    if (!session) return;
    if (!rating) return setError('Choose a rating.');
    if (!body.trim()) return setError('Write a few words.');
    if (!name.trim()) return setError('Add the name to show.');
    setBusy(true);
    setError(null);
    try {
      // The database makes it pending (an admin checks it, D-052) and decides "verified" (D-056).
      const review = await createReview(supabase, { productId, userId: session.user.id, rating, body: body.trim().slice(0, 2000), displayName: name.trim().slice(0, 60) });
      let note = '';
      if (review.is_verified_buyer) {
        for (const [i, uri] of photos.entries()) {
          const bytes = await (await fetch(uri)).arrayBuffer();
          const { type, ext } = sniff(bytes);
          const path = `${session.user.id}/${review.id}/${Date.now().toString(36)}-${i}.${ext}`;
          const { error: upload } = await supabase.storage.from('review-media').upload(path, bytes, { contentType: type });
          if (upload) {
            note = ' Your review is in, but a photo did not upload.';
            break;
          }
          await addReviewPhoto(supabase, review.id, path, i);
        }
      }
      setSent(`Thank you. We read every review before it appears on the page.${note}`);
    } catch {
      setError('We could not save your review. If you already reviewed this piece, that one counts.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-[18px]">
      <View className="bg-surface flex-row items-center gap-3 rounded-[16px] p-2.5">
        <View className="bg-land aspect-[3/4] w-[50px] overflow-hidden rounded-lg">
          {ready.piece.primary_image_path ? <Photo path={ready.piece.primary_image_path} width={50} /> : null}
        </View>
        <View className="flex-1">
          <Text className="font-display text-[17px] text-[#1D1A17]">{ready.piece.name}</Text>
          <Text className="font-ui text-ink-muted text-xs">
            {ready.piece.category_name} · {ready.piece.region_name}
          </Text>
        </View>
      </View>
      {sent ? (
        <View className="bg-surface rounded-lg p-5" accessibilityLiveRegion="polite">
          <Text className="font-body text-ink text-base leading-6">{sent}</Text>
        </View>
      ) : (
        <>
          <View>
            <Text className={label}>Your rating</Text>
            <View className="flex-row items-center" accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} of 5`} accessibilityState={{ checked: rating === n }} onPress={() => setRating(n)} className="h-11 w-11 items-center justify-center">
                  <Ionicons name="star" size={32} color={n <= rating ? tokens.colors.brand : tokens.colors.line} />
                </Pressable>
              ))}
              <Text className="font-ui-semibold text-ink ml-2 text-[15px]">{rating ? `${rating} of 5` : ''}</Text>
            </View>
          </View>
          <View>
            <Text className={label}>Your review</Text>
            <TextInput value={body} onChangeText={setBody} multiline maxLength={2000} textAlignVertical="top" accessibilityLabel="Your review" className={`${box} min-h-[110px]`} />
          </View>
          <View>
            <Text className={label}>Name to show</Text>
            <TextInput value={name} onChangeText={setName} maxLength={60} accessibilityLabel="Name to show" className={`${box} min-h-12`} />
          </View>
          {ready.verified ? (
            <View>
              <Text className={label}>Photos (up to {MAX_PHOTOS}, optional)</Text>
              <View className="flex-row gap-2">
                {photos.map((uri, i) => (
                  <View key={uri} className="bg-land aspect-square flex-1 overflow-hidden rounded-xl">
                    <Image source={uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={() => setPhotos((all) => all.filter((x) => x !== uri))} className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-[rgba(20,17,15,0.7)]">
                      <Text className="font-ui-semibold text-[15px] text-white">×</Text>
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Add photo" onPress={() => void addPhotos()} className="border-ink-muted aspect-square flex-1 items-center justify-center rounded-xl border-[1.5px] border-dashed">
                    <Text className="font-ui-semibold text-ink text-center text-xs">{'+\nAdd photo'}</Text>
                  </Pressable>
                ) : null}
                {Array.from({ length: Math.max(0, MAX_PHOTOS - 1 - photos.length) }, (_, i) => (
                  <View key={`space-${i}`} className="flex-1" />
                ))}
              </View>
              <Text className="font-body text-ink-muted mt-1.5 text-[13px]">You bought this piece, so you can add photos of it.</Text>
            </View>
          ) : (
            <Text className="font-body text-ink-muted text-[13px]">Photos can be added by customers who received this piece.</Text>
          )}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label={busy ? 'Sending…' : 'Send review'} onPress={() => void send()} disabled={busy} />
          <Text className="font-body text-ink-muted -mt-2 text-sm">We read every review before it appears on the page.</Text>
        </>
      )}
    </View>
  );
}

/**
 * Write a review in the app (D-090, D-095): the form as a sheet over the product instead of the website. Signed out,
 * the sign-in card comes first in the same sheet. The piece at the top, five large stars, the text and the name, and
 * for verified buyers photo tiles (× removes, + Add photo hides at 4). The customer's own session writes it; the
 * database keeps every rule (pending, verified, photos only for verified buyers).
 */
export function ReviewSheet({ productId, open, onClose }: { productId: string; open: boolean; onClose: () => void }): React.JSX.Element {
  const { session } = useSession();
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!session) return;
    setReady(null);
    setError(null);
    try {
      const [piece, eligibility, profile] = await Promise.all([
        getReviewableProduct(supabase, productId),
        getReviewEligibility(supabase, productId),
        getMyProfile(supabase, session.user.id),
      ]);
      if (!piece) return setError("This piece can't be reviewed right now.");
      setReady({ piece, verified: eligibility.is_verified_buyer, reviewed: eligibility.has_reviewed, displayName: profile?.full_name?.split(' ')[0] ?? '' });
    } catch {
      setError('Could not open the review form. Try again.');
    }
  }, [productId, session]);
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1 bg-[rgba(20,17,15,0.4)]" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="bg-canvas absolute bottom-0 left-0 right-0 max-h-[88%] rounded-t-[22px]">
        <SafeAreaView edges={['bottom']}>
          <View className="bg-line mx-auto mb-3 mt-2.5 h-1 w-10 rounded-sm" />
          <View className="flex-row items-center justify-between px-4 pb-3.5">
            <Text accessibilityRole="header" className="font-heading text-[22px] text-[#1D1A17]">
              Write a review
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="bg-surface h-8 w-8 items-center justify-center rounded-full">
              <Ionicons name="close" size={16} color={tokens.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="px-4 pb-8" keyboardShouldPersistTaps="handled">
            {!session ? (
              <SignInCard why="Sign in to write your review." onDone={() => void load()} />
            ) : error ? (
              <ErrorText>{error}</ErrorText>
            ) : ready ? (
              <Form productId={productId} ready={ready} />
            ) : (
              <Loading />
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
