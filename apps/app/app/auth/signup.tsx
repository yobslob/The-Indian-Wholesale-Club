import { Screen, Title } from '@/components/ui';
import { AuthForm } from '@/features/auth/auth-form';

export default function SignupScreen(): React.JSX.Element {
  return (
    <Screen>
      <Title>Create an account</Title>
      <AuthForm mode="signup" />
    </Screen>
  );
}
