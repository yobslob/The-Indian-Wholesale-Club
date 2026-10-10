import { joinRegions } from '@repo/db/vendor';
import { t } from '@repo/shared/vendor';

import { publicLang } from '@/features/vendor/guard';
import { JoinForm } from '@/features/vendor/join-form';
import { LanguageSwitch } from '@/features/vendor/nav';
import { storeClient } from '@/lib/supabase/store';

/** "Join as a vendor?" (D-102), reached only from the vendor sign-in page. The regions list is customer-safe. */
export default async function VendorJoinPage(): Promise<React.JSX.Element> {
  const lang = await publicLang();
  const regions = await joinRegions(storeClient());
  return (
    <main className="font-ui mx-auto max-w-md space-y-6 px-4 py-10">
      <LanguageSwitch lang={lang} />
      <div className="border-line bg-paper space-y-4 rounded-[18px] border p-6">
        <h1 className="font-heading text-[26px] font-semibold leading-tight">{t(lang, 'join_title')}</h1>
        <p className="text-[16px]">{t(lang, 'join_body')}</p>
        <JoinForm lang={lang} regions={regions} />
      </div>
    </main>
  );
}
