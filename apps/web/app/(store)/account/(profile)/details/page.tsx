import { getMyProfile } from '@repo/db/account';

import { updateProfileAction } from '@/features/account/actions';
import { customerOrNull } from '@/features/account/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your details', robots: { index: false } };

const input = 'border-line bg-paper focus:border-ink mt-1.5 block min-h-12 w-full rounded-md border px-3.5 text-[15px] font-normal outline-none';

/** Your details (D-089): the email (as signed in), full name and phone, Save. */
export default async function DetailsPage(): Promise<React.JSX.Element | null> {
  const me = await customerOrNull();
  if (!me) return null;
  const profile = await getMyProfile(me.client, me.user.id);
  return (
    <section aria-labelledby="details-h">
      <h2 id="details-h" className="font-heading m-0 mb-4 text-[22px] font-medium leading-tight text-[#1D1A17]">
        Your details
      </h2>
      <form action={updateProfileAction} className="font-ui grid max-w-[420px] gap-3.5 text-[13px] font-medium">
        <p className="m-0">
          Email
          <span className="border-line text-ink-muted mt-1.5 block min-h-12 rounded-md border px-3.5 text-[15px] font-normal leading-[46px]">
            {profile?.email ?? me.user.email}
          </span>
        </p>
        <label>
          Full name
          <input name="fullName" defaultValue={profile?.full_name ?? ''} autoComplete="name" className={input} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" defaultValue={profile?.phone ?? ''} autoComplete="tel" className={input} />
        </label>
        <button type="submit" className="bg-brand text-on-brand mt-1 min-h-[52px] justify-self-start rounded-pill px-7 text-base font-semibold">
          Save
        </button>
      </form>
    </section>
  );
}
