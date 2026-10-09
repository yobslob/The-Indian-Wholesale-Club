import { useLocalSearchParams } from 'expo-router';

import { CycleView } from '@/features/admin/cycle-view';

/** One cycle, opened from Today or the Cycle tab's other cycles (D-097). */
export default function AdminCycleScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CycleView id={id} />;
}
