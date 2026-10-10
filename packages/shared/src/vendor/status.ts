import type { MessageKey } from './i18n';

/** What a vendor sees for a piece's state (D-103): one word and a colour, pictures carry the rest. Web and app. */
export type Tone = 'wait' | 'ok' | 'act' | 'mute';

export function pieceStatus(kind: 'submission' | 'product', status: string): { key: MessageKey; tone: Tone } {
  if (kind === 'product') {
    if (status === 'live') return { key: 'status_live', tone: 'ok' };
    if (status === 'draft') return { key: 'status_draft', tone: 'wait' };
    return { key: 'status_paused', tone: 'mute' };
  }
  if (status === 'waiting') return { key: 'status_waiting', tone: 'wait' };
  if (status === 'photos_ready') return { key: 'status_photos_ready', tone: 'wait' };
  if (status === 'needs_retake') return { key: 'status_needs_retake', tone: 'act' };
  if (status === 'declined') return { key: 'status_declined', tone: 'mute' };
  return { key: 'status_adding', tone: 'act' };
}

/** Tailwind / NativeWind classes on the shared tokens: the same on the website and in the app. */
export const TONE_CLASS: Record<Tone, string> = {
  wait: 'bg-caution/15 text-ink',
  ok: 'bg-positive/15 text-ink',
  act: 'bg-danger/15 text-danger',
  mute: 'bg-line text-ink-muted',
};

/** India time, in the vendor's language: "12 October". */
export function shortDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(`${lang}-IN`, { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(iso));
  }
}
