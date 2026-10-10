'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { isLanguage } from '@repo/shared/vendor';

import { sessionClient } from '@/lib/supabase/server';

import { LANG_COOKIE } from './guard';

/** The language switch on every vendor screen (D-102). Kept in a cookie for a year; nothing about the vendor in it. */
export async function setVendorLanguageAction(formData: FormData): Promise<void> {
  const lang = String(formData.get('lang') ?? '');
  const back = String(formData.get('back') ?? '/vendor');
  if (isLanguage(lang)) {
    (await cookies()).set(LANG_COOKIE, lang, { path: '/vendor', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: true });
  }
  redirect(back.startsWith('/vendor') ? back : '/vendor');
}

export async function vendorSignOutAction(): Promise<void> {
  const client = await sessionClient();
  await client.auth.signOut();
  redirect('/vendor/login');
}
