import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AdminButton } from './ui';

import type { Href } from 'expo-router';


export interface Job {
  /** How many wait; null when it can't be counted yet (a missing setting). */
  n: number | null;
  what: string;
  sub?: string;
  go: string;
  href: Href;
  /** Waits on someone outside (a customer, a shop): its count and button stand out. */
  urgent?: boolean;
}

/** A desk's work queue on Today (D-097): the count, the job, one big button to it. Nothing waiting: faded, no button. */
export function Queue({ jobs }: { jobs: Job[] }): React.JSX.Element {
  const router = useRouter();
  return (
    <View className="gap-2.5">
      {jobs.map((j) => {
        const zero = j.n === 0;
        return (
          <View key={j.what} className={`border-line bg-paper gap-3 rounded-[14px] border px-4 py-3.5 ${zero ? 'opacity-55' : ''}`}>
            <View className="flex-row items-center gap-3.5">
              <Text className={`font-ui-semibold w-[52px] text-center text-[28px] ${j.urgent && !zero ? 'text-brand' : 'text-ink'}`}>{j.n ?? '—'}</Text>
              <View className="flex-1">
                <Text className="font-ui-semibold text-ink text-[15px] leading-5">{j.what}</Text>
                {j.sub || zero ? <Text className="font-body text-ink-muted text-[13px]">{zero ? 'Nothing to do' : j.sub}</Text> : null}
              </View>
            </View>
            {zero ? null : <AdminButton label={j.go} kind={j.urgent ? 'primary' : 'secondary'} onPress={() => router.push(j.href)} />}
          </View>
        );
      })}
    </View>
  );
}
