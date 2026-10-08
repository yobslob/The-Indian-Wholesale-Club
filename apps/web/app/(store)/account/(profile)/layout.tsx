import { signOutAction } from '@/features/account/actions';
import { ProfileNav } from '@/features/account/profile-nav';
import { customerOrNull } from '@/features/account/session';
import { SignInCard } from '@/features/auth/sign-in-card';

const signOut = 'font-ui text-ink-muted min-h-11 text-sm font-medium';

/**
 * The profile (D-089): what the profile icon opens. One page, four sections (Orders · Saved · Addresses · Your
 * details), Sign out at the foot. Signed out, the page itself shows the sign-in card (D-087: no sign-in prompts
 * anywhere else); once signed in, the same address shows the section.
 */
export default async function ProfileLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  if (!(await customerOrNull())) return <SignInCard />;
  return (
    <div>
      <h1 className="font-heading m-0 pb-5 text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.02em] text-[#1D1A17]">
        Your account
      </h1>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[clamp(24px,3vw,48px)] min-[821px]:grid-cols-[220px_minmax(0,1fr)]">
        <div className="sticky top-[calc(var(--top-h)+16px)] hidden min-[821px]:block">
          <ProfileNav variant="side" />
          <form action={signOutAction} className="mt-3 px-3.5">
            <button type="submit" className={signOut}>
              Sign out
            </button>
          </form>
        </div>
        <div>
          <div className="min-[821px]:hidden">
            <ProfileNav variant="tabs" />
          </div>
          {children}
          <form action={signOutAction} className="mt-7 min-[821px]:hidden">
            <button type="submit" className={`${signOut} underline underline-offset-[3px]`}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
