import { Text, View } from 'react-native';

import { vendorMoney } from '@repo/db/vendor';
import { formatRupees, shortDate } from '@repo/shared/vendor';

import { ErrorText, Heading, Screen } from '@/components/ui';
import { useVendor } from '@/features/vendor/context';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Money (D-102): owed in ₹ for collected pieces, then the pieces collected and the payouts made. */
export default function MoneyScreen(): React.JSX.Element {
  const { w, lang } = useVendor();
  const { data, error, loading, reload } = useQuery('vendor:money', () => vendorMoney(supabase));
  return (
    <Screen back={false} title={w('money')} refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View className="bg-brand gap-1 rounded-lg p-5">
        <Text className="font-body text-on-brand text-[15px]">{w('owed')}</Text>
        <Text className="font-ui text-on-brand text-[36px]">{formatRupees(data?.owed_paise ?? 0)}</Text>
        {data?.unpriced_pieces ? <Text className="font-body text-on-brand text-[14px]">+ {data.unpriced_pieces} · {w('amount_pending')}</Text> : null}
      </View>
      <Heading>{w('collected')}</Heading>
      {data?.collected.map((c, i) => (
        <View key={`${c.picked_at ?? ''}-${i}`} className="border-line bg-paper flex-row items-center justify-between gap-3 rounded-md border px-3 py-2">
          <View className="flex-1">
            <Text className="font-ui text-ink text-[15px]" numberOfLines={1}>{c.product_name} · {c.variant_label} × {c.quantity}</Text>
            <Text className="font-body text-ink-muted text-[13px]">{c.picked_at ? shortDate(c.picked_at, lang) : ''}{c.paid ? ` · ${w('paid')}` : ''}</Text>
          </View>
          <Text className="font-ui text-ink text-[16px]">{c.amount_paise === null ? '—' : formatRupees(c.amount_paise)}</Text>
        </View>
      ))}
      <Heading>{w('paid')}</Heading>
      {data?.payouts.map((p, i) => (
        <View key={`${p.paid_at}-${i}`} className="border-line bg-paper flex-row items-center justify-between gap-3 rounded-md border px-3 py-2">
          <View className="flex-1">
            <Text className="font-ui text-ink text-[15px]">{shortDate(p.paid_at, lang)}</Text>
            <Text className="font-body text-ink-muted text-[13px]" numberOfLines={1}>{[p.method, p.reference].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text className="font-ui text-ink text-[17px]">{formatRupees(p.amount_paise)}</Text>
        </View>
      ))}
    </Screen>
  );
}
