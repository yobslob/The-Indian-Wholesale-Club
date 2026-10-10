import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { isVendor, vendorMe, type VendorMe } from '@repo/db/vendor';
import { isLanguage, type Language } from '@repo/shared/vendor';

import { currentUser, sessionClient } from '@/lib/supabase/server';

import type { IwcClient } from '@repo/db';

/**
 * Vendor access (D-102, D-103): signed in AND a vendor account (role vendor + an active account, decided by the
 * database, is_vendor()). The vendor_* functions check it again and return only the caller's own vendor (INV-10).
 */
export type VendorAccess = { client: IwcClient; me: VendorMe; lang: Language };

/** The vendor's chosen screen language: the switch's cookie, else the account's language, else Hindi. */
export const LANG_COOKIE = 'iwc_vendor_lang';

export const vendorAccess = cache(async (): Promise<VendorAccess | null> => {
  const client = await sessionClient();
  if (!(await currentUser(client))) return null;
  if (!(await isVendor(client))) return null;
  const me = await vendorMe(client);
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  const lang: Language = isLanguage(chosen) ? chosen : isLanguage(me.language) ? me.language : 'hi';
  return { client, me, lang };
});

/** Vendor pages: anyone who is not a signed-in vendor goes to the vendor sign-in page. */
export async function requireVendorPage(): Promise<VendorAccess> {
  const access = await vendorAccess();
  if (!access) redirect('/vendor/login');
  return access;
}

/** The language for pages a vendor may see signed out (sign-in, join): the cookie, else Hindi. */
export async function publicLang(): Promise<Language> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  return isLanguage(chosen) ? chosen : 'hi';
}
