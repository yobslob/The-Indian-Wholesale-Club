import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { savingCents } from '@repo/shared/domain';


import { useCountry } from '../shell/country';

import { freeDelivery, useBagCharges } from './charges';
import { useBag } from './store';

import { API_BASE_URL } from '@/lib/api';

let pct: number | null | undefined;

/**
 * D-208 in the app: the bag's 5% saving, in the website's card look (light paper, wine border, stitched edge): what this
 * bag saves, paid by IWC (the bag's total does not change). The app keeps it as Coins; sending it to Maa is on the
 * website for now (Claude's draft words, D-012).
 */
export function SavingCard({ goodsCents }: { goodsCents: number }): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const charges = useBagCharges();
  const money = useCountry();
  const [savePct, setSavePct] = useState(pct);
  useEffect(() => {
    if (pct !== undefined) return;
    void fetch(`${API_BASE_URL}/api/send-home`)
      .then((r) => r.json() as Promise<{ sendHome?: { save_pct?: number } | null }>)
      .then((b) => {
        pct = b.sendHome?.save_pct ?? null;
        setSavePct(pct);
      })
      .catch(() => undefined);
  }, []);
  // after the bulk saving, before shipping, charges, Coins and tax (as the website and checkout work it out)
  const bulk = freeDelivery(lines, charges).bulk.savingCents;
  const cents = savingCents(goodsCents - bulk, savePct ?? null);
  if (cents <= 0) return null;
  return (
    <View className="bg-paper border-brand mt-2 rounded-[20px] border-[1.5px] p-4">
      <Text className="font-ui-semibold text-ink-muted text-[10px] uppercase tracking-[1.6px]">Your 5%</Text>
      <Text className="font-heading text-ink text-[16px]">You&apos;re saving {money.format(cents)} on this bag.</Text>
      <Text className="font-body text-ink-muted mt-1 text-[12.5px]">
        It goes into your Coins for your next order. To send it home to Maa instead, check out on our website.
      </Text>
    </View>
  );
}
