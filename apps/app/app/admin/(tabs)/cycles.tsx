import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { listCycles } from '@repo/db/admin';

import { Body, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { utc } from '@/features/admin/format';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * Cycles (flows.md §1), newest first. Opening one shows its pickup checklist.
 * New cycles are created on the web panel (dates are typed in by an admin, D-026).
 */
export default function AdminCyclesScreen(): React.JSX.Element {
  const router = useRouter();
  const { data, error, loading, reload } = useQuery('admin:cycles', () => listCycles(supabase, 30));

  return (
    <Screen back={false} refreshing={loading} onRefresh={reload}>
      <Title>Cycles</Title>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 ? (
        <Body muted>No cycles yet. Create the first one on the web panel.</Body>
      ) : null}
      {data?.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => router.push({ pathname: '/admin/cycle/[id]', params: { id: c.id } })}
          className="border-line min-h-11 gap-1 rounded-md border p-3"
        >
          <Text className="text-ink font-medium">
            {c.code} · {c.status}
          </Text>
          <Text className="text-ink-muted text-sm">
            Cutoff {utc(c.cutoff_at)} · est. arrival {c.est_arrival_on}
          </Text>
        </Pressable>
      ))}
    </Screen>
  );
}
