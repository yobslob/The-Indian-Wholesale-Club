import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getStorePolicy } from '@repo/db/store';
import { INFO_PAGES, infoBlocks, type Block, type InfoSlug, type Inline } from '@repo/shared/info';
import tokens from '@repo/tokens';

import { ErrorText, Loading } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Where an info link goes in the app: another tab of the sheet, an app screen, or the phone (mail, web). */
function useFollow(setTab: (slug: InfoSlug) => void, close: () => void): (to: string) => void {
  const router = useRouter();
  return (to) => {
    const tab = INFO_PAGES.find((pg) => `/${pg.slug}` === to);
    if (tab) return setTab(tab.slug);
    if (to === '/orders/lookup') {
      close();
      return router.push('/order/lookup');
    }
    void Linking.openURL(to);
  };
}

function Runs({ parts, follow, className }: { parts: Inline[]; follow: (to: string) => void; className: string }): React.JSX.Element {
  return (
    <Text className={className}>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : 'strong' in part ? (
          <Text key={i} className="font-body-semibold">
            {part.strong}
          </Text>
        ) : (
          <Text key={i} accessibilityRole="link" onPress={() => follow(part.to)} className="underline">
            {part.link}
          </Text>
        ),
      )}
    </Text>
  );
}

function Question({ q, a, follow }: { q: string; a: Block[]; follow: (to: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <View className="border-b border-[rgba(30,27,22,0.1)]">
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} className="min-h-[50px] flex-row items-center justify-between gap-3">
        <Text className="font-ui-semibold text-ink flex-1 text-[15px]">{q}</Text>
        <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-[rgba(255,255,255,0.7)]">
          <Text className="font-ui text-ink text-base">{open ? '−' : '+'}</Text>
        </View>
      </Pressable>
      {open ? (
        <View className="gap-2 pb-3">
          <Blocks blocks={a} follow={follow} />
        </View>
      ) : null}
    </View>
  );
}

/** The info pages' blocks (@repo/shared/info, one source with the website, D-095) in the app's text styles. */
function Blocks({ blocks, follow }: { blocks: Block[]; follow: (to: string) => void }): React.JSX.Element {
  const body = 'font-body text-ink text-[15px] leading-6';
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'h')
          return (
            <Text key={i} accessibilityRole="header" className="font-ui-semibold text-ink mt-2 text-base">
              {b.text}
            </Text>
          );
        if (b.kind === 'p') return <Runs key={i} parts={b.parts} follow={follow} className={`${body} ${b.muted ? 'text-ink-muted' : ''} ${b.small ? 'text-sm' : ''}`} />;
        if (b.kind === 'ul' || b.kind === 'ol')
          return (
            <View key={i} className="gap-1.5">
              {b.items.map((item, j) => (
                <View key={j} className="flex-row gap-2">
                  <Text className={body}>{b.kind === 'ol' ? `${j + 1}.` : '•'}</Text>
                  <Runs parts={item} follow={follow} className={`${body} flex-1`} />
                </View>
              ))}
            </View>
          );
        const qa = b.kind === 'qa' ? b.items : [];
        return (
          <View key={i}>
            {qa.map((item) => (
              <Question key={item.q} q={item.q} a={item.a} follow={follow} />
            ))}
          </View>
        );
      })}
    </>
  );
}

/**
 * About us & help (D-092, D-095): the website's glass panel as a sheet over the app (solid: the app has no blur, and
 * see-through text behind hurt reading), with the seven tabs (About us,
 * How it works, FAQ, Shipping & returns, Contact, Privacy, Terms) and a small ×. The wording is the website's, from
 * one shared source; FAQ and Shipping & returns state the store's own numbers (store_policy(), D-008).
 */
export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  const [tab, setTab] = useState<InfoSlug>('about');
  // Read only once the sheet is open (the key changes with it, so a closed sheet's empty answer is never reused).
  const policy = useQuery(open ? 'store-policy' : 'store-policy:closed', () => (open ? getStorePolicy(supabase) : Promise.resolve(null)));
  const follow = useFollow(setTab, onClose);
  const needsPolicy = tab === 'faq' || tab === 'shipping-returns';
  const title = INFO_PAGES.find((pg) => pg.slug === tab)?.title ?? '';

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1 bg-[rgba(20,17,15,0.35)]" />
      <View className="bg-paper border-line absolute bottom-0 left-0 right-0 h-[88%] rounded-t-[24px] border">
        <SafeAreaView edges={['bottom']} className="flex-1">
          <View className="mx-auto mb-2.5 mt-2.5 h-1 w-10 rounded-sm bg-[rgba(30,27,22,0.2)]" />
          <View className="flex-row items-center border-b border-[rgba(30,27,22,0.08)] pb-2.5 pl-3.5 pr-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 pr-2" className="flex-1">
              {INFO_PAGES.map((pg) => (
                <Pressable
                  key={pg.slug}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === pg.slug }}
                  onPress={() => setTab(pg.slug)}
                  className={`h-9 justify-center rounded-pill px-3 ${tab === pg.slug ? 'bg-[rgba(30,27,22,0.88)]' : ''}`}
                >
                  <Text className={`font-ui text-[13px] ${tab === pg.slug ? 'text-paper' : 'text-ink-muted'}`}>{pg.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.6)]">
              <Ionicons name="close" size={16} color={tokens.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-3 p-[18px] pb-10">
            <Text accessibilityRole="header" className="font-heading text-[28px] leading-[31px] text-[#1D1A17]">
              {title}
            </Text>
            {needsPolicy && policy.error ? <ErrorText>{policy.error}</ErrorText> : null}
            {needsPolicy && !policy.data ? (
              policy.error ? null : <Loading />
            ) : (
              <Blocks blocks={infoBlocks(tab, { policy: policy.data ?? undefined })} follow={follow} />
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
