import { useState } from 'react';
import { Text } from 'react-native';

import { recordPayout } from '@repo/db/admin';

import { rupees } from './format';
import { useAction } from './use-action';

import { Body, Button, Card, ErrorText, Field } from '@/components/ui';
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
 * One shop's picked, unpaid pieces and the "record payout" form (flows.md §5).
 * The amount shown is a preview; the database computes the payout from the pickups.
 */
export function PayoutCard({
  group,
  onDone,
}: {
  group: PayableGroup;
  onDone: () => void;
}): React.JSX.Element {
  const [method, setMethod] = useState(group.method ?? '');
  const [reference, setReference] = useState('');
  const action = useAction(onDone);

  function submit(): void {
    const m = method.trim();
    if (m.length < 2) return;
    void action.run(() =>
      recordPayout(supabase, {
        vendorId: group.vendorId,
        pickupIds: group.pickupIds,
        method: m,
        reference: reference.trim() || undefined,
      }),
    );
  }

  return (
    <Card>
      <Text className="text-ink font-medium">
        {group.name} · owed {rupees(group.paise)}
      </Text>
      {group.lines.map((line, i) => (
        <Body key={i} muted>
          {line}
        </Body>
      ))}
      <Field label="Method" value={method} onChangeText={setMethod} />
      <Field
        label="Reference"
        value={reference}
        onChangeText={setReference}
        placeholder={group.reference ?? 'UPI / bank ref'}
        autoCapitalize="none"
      />
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      <Button
        label="Record payout"
        onPress={submit}
        disabled={action.busy || method.trim().length < 2}
      />
    </Card>
  );
}
