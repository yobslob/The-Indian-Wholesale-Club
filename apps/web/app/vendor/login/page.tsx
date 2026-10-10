import { redirect } from 'next/navigation';

import { t } from '@repo/shared/vendor';

import { publicLang, vendorAccess } from '@/features/vendor/guard';
import { LanguageSwitch } from '@/features/vendor/nav';
import { VendorSignIn } from '@/features/vendor/sign-in';

/**
 * Vendor sign-in (D-102): the QR / link's page. Signed-in vendors go straight in. "Join as a vendor?" lives only here
 * (never on a customer page, D-003).
 */
export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}): Promise<React.JSX.Element> {
  const { code } = await searchParams;
  if (!code && (await vendorAccess())) redirect('/vendor');
  const lang = await publicLang();
  return (
    <main className="font-ui mx-auto max-w-md space-y-6 px-4 py-10">
      <LanguageSwitch lang={lang} />
      <div className="border-line bg-paper space-y-5 rounded-[18px] border p-6">
        <p className="text-ink-muted text-[12px] font-semibold uppercase tracking-[0.08em]">{t(lang, 'brand')}</p>
        <h1 className="font-heading text-[28px] font-semibold leading-tight">{t(lang, 'login_title')}</h1>
        <VendorSignIn lang={lang} initialCode={code ?? ''} />
      </div>
    </main>
  );
}
