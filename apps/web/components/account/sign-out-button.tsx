'use client';

import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className = '' }: SignOutButtonProps): React.JSX.Element {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className={`text-sm font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-900 ${className}`}
    >
      Sign out
    </button>
  );
}
