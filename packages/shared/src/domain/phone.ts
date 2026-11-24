/**
 * Checkout's phone number (D-087): US only, +1, for delivery. Shared by the website and the app so both accept the
 * same numbers.
 */

/** A US number as ten digits (an optional leading 1 dropped), or null. Area codes never start with 0 or 1. */
export function usPhoneDigits(text: string): string | null {
  const digits = text.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return /^[2-9]\d{9}$/.test(digits) ? digits : null;
}

/** +1 (732) 555-0142 */
export function formatUsPhone(digits: string): string {
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * D-208: a phone from any country IWC delivers to: a US (or other +1) number as its 10 digits, as before; any other as
 * "+" and its 8 – 15 digits, its country code first ("+44 20 7946 0958" → "+442079460958"). Null when it is neither.
 */
export function anyPhone(text: string): string | null {
  const t = text.trim();
  if (t.startsWith('+') && !t.startsWith('+1')) {
    const digits = t.replace(/\D/g, '');
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  return usPhoneDigits(t);
}

/** How a phone from anyPhone reads: "+1 (732) 555-0142", or "+442079460958" as given. */
export function formatAnyPhone(phone: string): string {
  return phone.startsWith('+') ? phone : formatUsPhone(phone);
}

/** The phone for the card network (E.164): "+17325550142", "+442079460958". */
export function e164Phone(phone: string): string {
  return phone.startsWith('+') ? phone : `+1${phone}`;
}
