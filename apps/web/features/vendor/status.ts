import type { MessageKey } from '@repo/shared/vendor';

/** What a vendor sees for a piece's state (D-103): one word and a colour, pictures carry the rest. */
export type Tone = 'wait' | 'ok' | 'act' | 'mute';

export function pieceStatus(kind: 'submission' | 'product', status: string): { key: MessageKey; tone: Tone } {
  if (kind === 'product') {
    if (status === 'live') return { key: 'status_live', tone: 'ok' };
    if (status === 'draft') return { key: 'status_draft', tone: 'wait' };
    return { key: 'status_paused', tone: 'mute' };
  }
  switch (status) {
    case 'waiting':
      return { key: 'status_waiting', tone: 'wait' };
    case 'photos_ready':
      return { key: 'status_photos_ready', tone: 'wait' };
    case 'needs_retake':
      return { key: 'status_needs_retake', tone: 'act' };
    case 'declined':
      return { key: 'status_declined', tone: 'mute' };
    default:
      return { key: 'status_adding', tone: 'act' };
  }
}

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
