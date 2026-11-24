/**
 * D-205, Send home: a gift in rupees to a loved one in India, paid with the order but never part of the goods. Pure: the
 * bag, checkout's server and the admin's payout screen all use these, so a figure reads the same everywhere.
 */

/** Who a loved one is to the customer; the sheet's chips fill the call name, which the customer can change. */
export const RELATIONS = ['maa', 'papa', 'dadi', 'nani', 'dada', 'nana', 'bhaiya', 'didi', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_NAMES: Record<Relation, string> = {
  maa: 'Maa',
  papa: 'Papa',
  dadi: 'Dadi',
  nani: 'Nani',
  dada: 'Dada',
  nana: 'Nana',
  bhaiya: 'Bhaiya',
  didi: 'Didi',
  other: '',
};

/** "her UPI", "his UPI", else "their UPI" (Someone else, or a name the customer typed). */
export function upiOwnerWord(relation: Relation): 'her' | 'his' | 'their' {
  if (relation === 'maa' || relation === 'dadi' || relation === 'nani' || relation === 'didi') return 'her';
  if (relation === 'papa' || relation === 'dada' || relation === 'nana' || relation === 'bhaiya') return 'his';
  return 'their';
}

/** The call name's and the line's limits (the table checks the same). */
export const CALL_NAME_MAX = 20;
export const GIFT_LINE_MAX = 30;
/** UPI's note field: the payer's app cuts longer notes. */
export const UPI_NOTE_MAX = 50;
/** The smallest round-up gift (plan §2 rule 3): under it the round-up goes to the 9 after. */
export const ROUND_UP_MIN_CENTS = 300;
/** The fixed chips after the round-up (D-205; D-206 left them as drafted). */
export const GIFT_CHIPS_CENTS = [900, 1900] as const;

/**
 * The round-up gift: what brings the bag total to the next whole dollar ending in 9, at least $3, else the 9 after it.
 * $85.00 → $4.00 (to $89), $84.00 → $5.00, $87.40 → $11.60 (to $99), $89.00 → $10.00.
 */
export function roundUpGiftCents(totalCents: number): number {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new RangeError('totalCents must be a non-negative integer');
  // the next total ending in 9 dollars (…9.00) strictly above the bag
  let target = Math.floor(totalCents / 1000) * 1000 + 900;
  if (target <= totalCents) target += 1000;
  if (target - totalCents < ROUND_UP_MIN_CENTS) target += 1000;
  return target - totalCents;
}

/**
 * The chips the bag offers: the round-up first, then $9 and $19 unless one of them is the round-up itself; none worth
 * more than the order itself (D-206). Empty for a bag too small for any of them.
 */
export function giftChipsCents(totalCents: number): number[] {
  const round = roundUpGiftCents(totalCents);
  return [round, ...GIFT_CHIPS_CENTS.filter((c) => c !== round)].filter((c) => c <= totalCents);
}

/** D-206: a gift is never more than the order's own total (before the gift). */
export const giftFitsOrder = (giftCents: number, orderCents: number): boolean => giftCents > 0 && giftCents <= orderCents;

/**
 * D-206: the rupees one gift dollar promises: the day's rate less what IWC keeps for sending it (3%). The store is only
 * ever given this figure, never the 3% itself.
 */
export function promisedRate(inrPerUsd: number | null, keepPct: number): number | null {
  if (inrPerUsd === null || !(inrPerUsd > 0)) return null;
  return inrPerUsd * (1 - Math.min(Math.max(keepPct, 0), 50) / 100);
}

/**
 * D-208: every order saves this much, paid by IWC: the % of its goods (after the bulk saving, before shipping, charges,
 * Coins and tax), to the cent. 0 while Settings has no %.
 */
export function savingCents(goodsCents: number, pct: number | null): number {
  if (pct === null || !(pct > 0) || !(goodsCents > 0)) return 0;
  return Math.round((goodsCents * pct) / 100);
}

/** The rupees a gift promises, in paise, rounded to the rupee (plan §2 rule 4), at the promised rate. Null when off. */
export function giftInrPaise(usdCents: number, inrPerUsd: number | null): number | null {
  if (inrPerUsd === null || !(inrPerUsd > 0)) return null;
  if (!Number.isInteger(usdCents) || usdCents < 0) throw new RangeError('usdCents must be a non-negative integer');
  return Math.round((usdCents / 100) * inrPerUsd) * 100;
}

export type Upi = { kind: 'vpa'; value: string } | { kind: 'mobile'; value: string };

const VPA = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,63}$/;

/**
 * A UPI ID (`name@handle`) or a 10-digit Indian mobile starting 6 – 9 (spaces, dashes, +91, 91 or 0 in front are
 * dropped), normalised; null when it is neither. The table's check is the same.
 */
export function upiOf(text: string): Upi | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.includes('@')) return VPA.test(trimmed) ? { kind: 'vpa', value: trimmed } : null;
  let digits = trimmed.replace(/[\s()-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? { kind: 'mobile', value: digits } : null;
}

/**
 * D-206, the UPI checker: handles UPI apps and banks use (not every one there is: an unknown handle is a warning to look
 * again, never a refusal). Whether the account exists needs a payouts provider (Q-67).
 */
export const UPI_HANDLES: Record<string, string> = {
  okhdfcbank: 'Google Pay', okicici: 'Google Pay', oksbi: 'Google Pay', okaxis: 'Google Pay',
  ybl: 'PhonePe', ibl: 'PhonePe', axl: 'PhonePe',
  paytm: 'Paytm', pthdfc: 'Paytm', ptsbi: 'Paytm', ptaxis: 'Paytm', ptyes: 'Paytm',
  apl: 'Amazon Pay', yapl: 'Amazon Pay', rapl: 'Amazon Pay',
  upi: 'BHIM', ikwik: 'MobiKwik', freecharge: 'Freecharge', fam: 'FamPay', jupiteraxis: 'Jupiter', naviaxis: 'Navi',
  waicici: 'WhatsApp', waaxis: 'WhatsApp', wahdfcbank: 'WhatsApp', wasbi: 'WhatsApp', superyes: 'super.money',
  sbi: 'SBI', icici: 'ICICI Bank', hdfcbank: 'HDFC Bank', axisbank: 'Axis Bank', kotak: 'Kotak', kbl: 'Karnataka Bank',
  pnb: 'PNB', barodampay: 'Bank of Baroda', unionbank: 'Union Bank', cnrb: 'Canara Bank', idfcbank: 'IDFC First',
  federal: 'Federal Bank', yesbank: 'Yes Bank', indus: 'IndusInd', rbl: 'RBL Bank', aubank: 'AU Bank', idbi: 'IDBI Bank',
  boi: 'Bank of India', mahb: 'Bank of Maharashtra', indianbank: 'Indian Bank', iob: 'Indian Overseas Bank',
  ucobank: 'UCO Bank', centralbank: 'Central Bank', dbs: 'DBS', hsbc: 'HSBC', sc: 'Standard Chartered',
  equitas: 'Equitas', ujjivan: 'Ujjivan', airtel: 'Airtel', jio: 'Jio', postbank: 'India Post',
};

export type UpiCheck =
  | { kind: 'empty' }
  | { kind: 'bad' }
  | { kind: 'mobile' }
  | { kind: 'known'; app: string }
  | { kind: 'unknown'; handle: string };

export function checkUpi(text: string): UpiCheck {
  if (!text.trim()) return { kind: 'empty' };
  const upi = upiOf(text);
  if (!upi) return { kind: 'bad' };
  if (upi.kind === 'mobile') return { kind: 'mobile' };
  const handle = upi.value.slice(upi.value.indexOf('@') + 1);
  const app = UPI_HANDLES[handle];
  return app ? { kind: 'known', app } : { kind: 'unknown', handle };
}

/** What a customer sees of a UPI ID: "98470·····", "lak···@okhdfc". The full ID is for the India desk only. */
export function maskUpi(upi: string): string {
  const at = upi.indexOf('@');
  if (at < 0) return `${upi.slice(0, 5)}·····`;
  return `${upi.slice(0, Math.min(3, at))}···${upi.slice(at)}`;
}

/** Only what every UPI app takes in a note: letters, digits, spaces and a little punctuation. */
const noteSafe = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 .,!?'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The customer's line as it may be stored (≤ 30, note-safe). */
export function giftLineOf(text: string): string {
  return noteSafe(text).slice(0, GIFT_LINE_MAX).trim();
}

/** The UPI note Maa sees: "From Yogesh in USA. Namaste Maa", at most 50 characters (plan §4.6). */
export function upiNote(firstName: string, line: string): string {
  const first = noteSafe(firstName).split(' ')[0] ?? '';
  const head = first ? `From ${first} in USA.` : 'From the USA.';
  const body = noteSafe(line);
  return (body ? `${head} ${body}` : head).slice(0, UPI_NOTE_MAX).trim();
}

/**
 * The India desk's "Pay in my UPI app" link (plan §2 rule 10): opens the desk's own UPI app with everything filled in.
 * A UPI ID only: a mobile number has no address a link can carry, so the desk pays it by number in the app (null).
 */
export function upiPayLink(gift: { upi: string; name: string; inrPaise: number; note: string }): string | null {
  const upi = upiOf(gift.upi);
  if (!upi || upi.kind !== 'vpa') return null;
  const q = [
    `pa=${encodeURIComponent(upi.value)}`,
    `pn=${encodeURIComponent(noteSafe(gift.name) || 'Loved one')}`,
    `am=${(Math.round(gift.inrPaise / 100)).toFixed(2)}`,
    'cu=INR',
    `tn=${encodeURIComponent(gift.note.slice(0, UPI_NOTE_MAX))}`,
  ];
  return `upi://pay?${q.join('&')}`;
}

/** The customer's status words for a gift (plan §2 rule 9): hold and to send both read "Sending". */
export type HomeGiftStatus = 'on_hold' | 'to_send' | 'sent' | 'failed' | 'refunded' | 'cancelled';
export type CustomerGiftStatus = 'sending' | 'sent' | 'refunded';

export function customerGiftStatus(status: HomeGiftStatus): CustomerGiftStatus {
  if (status === 'sent') return 'sent';
  if (status === 'on_hold' || status === 'to_send') return 'sending';
  return 'refunded';
}
