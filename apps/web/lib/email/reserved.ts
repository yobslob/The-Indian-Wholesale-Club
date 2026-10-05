/**
 * Addresses that can never receive mail (RFC 2606 / 6761: .test, .example, .invalid, .localhost and the example.*
 * domains): the E2E customer's orders use them. The sender marks their emails done without sending, so they never
 * clog the outbox or count as stuck. Pure, so it has unit tests (tests/order-update.test.ts).
 */
export function isReservedAddress(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return (
    /\.(test|example|invalid|localhost)$/.test(domain) || /^example\.(com|net|org)$/.test(domain) || domain === ''
  );
}
