import { Screen, Title } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';

export default function LoginScreen(): React.JSX.Element {
  return (
    <Screen>
      <Title>Sign in</Title>
      <AuthForm mode="login" />
    </Screen>
  );
}
