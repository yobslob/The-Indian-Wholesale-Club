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
