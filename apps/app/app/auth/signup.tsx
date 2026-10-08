import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui';
import { SignInCard } from '@/features/auth/sign-in-card';

/** Create an account (D-091, D-095): the same card, opened at Create an account. */
export default function SignupScreen(): React.JSX.Element {
  const router = useRouter();
  return (
    <Screen title="Create an account">
      <SignInCard start="create" onDone={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
    </Screen>
  );
}
