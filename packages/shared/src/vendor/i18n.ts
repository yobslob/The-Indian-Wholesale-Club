import { asm } from './messages/as';
import { bn } from './messages/bn';
import { en, type MessageKey, type Messages } from './messages/en';
import { gu } from './messages/gu';
import { hi } from './messages/hi';
import { kn } from './messages/kn';
import { ml } from './messages/ml';
import { mr } from './messages/mr';
import { or } from './messages/or';
import { pa } from './messages/pa';
import { ta } from './messages/ta';
import { te } from './messages/te';

/**
 * The vendor screens' languages (D-102: English and each region's language). Every language except English is a
 * Claude draft until someone fluent checks it; missing words fall back to English.
 */
export const LANGUAGES = {
  en: { name: 'English', messages: en },
  hi: { name: 'हिन्दी', messages: hi },
  bn: { name: 'বাংলা', messages: bn },
  ta: { name: 'தமிழ்', messages: ta },
  te: { name: 'తెలుగు', messages: te },
  mr: { name: 'मराठी', messages: mr },
  gu: { name: 'ગુજરાતી', messages: gu },
  kn: { name: 'ಕನ್ನಡ', messages: kn },
  ml: { name: 'മലയാളം', messages: ml },
  pa: { name: 'ਪੰਜਾਬੀ', messages: pa },
  or: { name: 'ଓଡ଼ିଆ', messages: or },
  as: { name: 'অসমীয়া', messages: asm },
} satisfies Record<string, { name: string; messages: Messages }>;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];

export const isLanguage = (code: string | null | undefined): code is Language =>
  typeof code === 'string' && code in LANGUAGES;

/** A region's listed language (regions.languages) → the vendor screens' language; Hindi where there is none. */
const BY_NAME: Record<string, string> = {
  Hindi: 'hi', Bengali: 'bn', Tamil: 'ta', Telugu: 'te', Marathi: 'mr', Gujarati: 'gu', Kannada: 'kn',
  Malayalam: 'ml', Punjabi: 'pa', Odia: 'or', Assamese: 'as',
};

export function languageForRegion(languages: readonly string[]): Language {
  for (const name of languages) {
    const code = BY_NAME[name];
    if (isLanguage(code)) return code;
  }
  return 'hi';
}

/**
 * The few languages the switch offers a shop (one tap each, never a list of twelve): English, Hindi, the shop's
 * region's language and the one it uses now.
 */
export function switchLanguages(current: string, regionLanguages: readonly string[] = []): Language[] {
  const list: Language[] = ['en', 'hi', languageForRegion(regionLanguages)];
  if (isLanguage(current)) list.push(current);
  return LANGUAGE_CODES.filter((code) => list.includes(code));
}

/** The word for `key` in `lang`, with {placeholders} filled. */
export function t(lang: string, key: MessageKey, vars?: Record<string, string | number>): string {
  const messages: Messages = isLanguage(lang) ? LANGUAGES[lang].messages : en;
  let text = messages[key] || en[key];
  for (const [name, value] of Object.entries(vars ?? {})) text = text.replace(`{${name}}`, String(value));
  return text;
}

export type { MessageKey };
