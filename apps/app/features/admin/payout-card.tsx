import { useState } from 'react';
import { Text, View } from 'react-native';

import { recordPayout } from '@repo/db/admin';

import { rupees } from './format';
import { AdminButton, Sheet } from './ui';
import { useAction } from './use-action';

import { ErrorText, Field } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export interface PayableGroup {
  vendorId: string;
  name: string;
  method: string | null;
  reference: string | null;
  pickupIds: string[];
  paise: number;
  lines: string[];
}

/**
 * One shop's picked, unpaid pieces (D-097, flows.md §5): the amount owed and its pieces; Record payout opens a sheet
 * that asks first with the amount (D-096's confirm rule). The database computes the payout from the pickups.
 */
export function PayoutCard({ group, onDone }: { group: PayableGroup; onDone: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState(group.method ?? '');
  const [reference, setReference] = useState('');
  const action = useAction(onDone);
  const pieces = group.pickupIds.length;

  return (
    <View className="border-line bg-paper overflow-hidden rounded-[14px] border">
      <View className="px-4 pb-2.5 pt-3.5">
        <Text className="font-heading-semibold text-ink text-[16px]">{group.name}</Text>
        <Text className="font-body text-ink-muted text-[13px]">{[group.method, group.reference].filter(Boolean).join(' · ') || 'No payment method saved'}</Text>
      </View>
      <View className="border-line gap-2.5 border-t px-4 py-3">
        <Text className="font-ui-semibold text-ink text-[22px]">{rupees(group.paise)}</Text>
        <Text className="font-body text-ink-muted text-[12.5px]">{group.lines.join(' · ')}</Text>
        <AdminButton big label="Record payout" onPress={() => setOpen(true)} />
      </View>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Record ${rupees(group.paise)} paid to ${group.name}?`}>
        <Text className="font-body text-ink-muted text-[14px] leading-5">
          For {pieces} picked piece{pieces === 1 ? '' : 's'}. They&apos;re marked paid to this shop; nothing is sent to the customer.
        </Text>
        <Field label="Method" value={method} onChangeText={setMethod} placeholder="UPI / bank" />
        <Field label="Reference" value={reference} onChangeText={setReference} placeholder={group.reference ?? 'UPI / bank ref'} autoCapitalize="none" />
        {action.error ? <ErrorText>{action.error}</ErrorText> : null}
        <AdminButton
          big
          label={action.busy ? 'Recording…' : `Record ${rupees(group.paise)}`}
          disabled={action.busy || method.trim().length < 2}
          onPress={() =>
            void action
              .run(() => recordPayout(supabase, { vendorId: group.vendorId, pickupIds: group.pickupIds, method: method.trim(), reference: reference.trim() || undefined }))
              .then((ok) => ok && setOpen(false))
          }
        />
        <AdminButton big kind="secondary" label="Not yet" onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}
