import { useRouter } from 'expo-router';

import { Screen } from '@/components/ui';
import { SignInCard } from '@/features/auth/sign-in-card';

/** Sign in (D-091, D-095): the profile's card, then back to where the customer came from. */
export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  return (
    <Screen title="Sign in">
      <SignInCard onDone={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
    </Screen>
  );
}
