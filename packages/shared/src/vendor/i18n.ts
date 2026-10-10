import { en, type MessageKey, type Messages } from './messages/en';
import { hi } from './messages/hi';

/**
 * The vendor screens' languages (D-102: English and each region's language). Every language except English is a
 * Claude draft until someone fluent checks it; missing words fall back to English.
 */
export const LANGUAGES = {
  en: { name: 'English', messages: en },
  hi: { name: 'हिन्दी', messages: hi },
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

/** The word for `key` in `lang`, with {placeholders} filled. */
export function t(lang: string, key: MessageKey, vars?: Record<string, string | number>): string {
  const messages: Messages = isLanguage(lang) ? LANGUAGES[lang].messages : en;
  let text = messages[key] || en[key];
  for (const [name, value] of Object.entries(vars ?? {})) text = text.replace(`{${name}}`, String(value));
  return text;
}

export type { MessageKey };
