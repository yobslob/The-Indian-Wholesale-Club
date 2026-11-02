/**
 * Stripe's payment errors in plain words (launch QA A-9). The decline reasons Stripe asks us not to reveal (lost,
 * stolen, fraud) read as a plain decline. Pure; tests/checkout-payment-errors.test.ts.
 */
export interface PaymentErrorLike {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
}

const DECLINED = 'Your card was declined. Please try another card, or call your bank.';
const VERIFY = 'Your bank could not verify this payment. Please try again or use another card.';

const BY_REASON: Record<string, string> = {
  insufficient_funds: 'Your card was declined for insufficient funds. Please try another card.',
  expired_card: 'Your card has expired. Please use another card.',
  incorrect_cvc: 'The security code (CVC) does not match. Please check it and try again.',
  invalid_cvc: 'The security code (CVC) does not match. Please check it and try again.',
  incorrect_zip: 'The ZIP code does not match your card. Please check it and try again.',
  incorrect_number: 'The card number is not right. Please check it and try again.',
  invalid_number: 'The card number is not right. Please check it and try again.',
  invalid_expiry_month: 'The expiry date is not right. Please check it and try again.',
  invalid_expiry_year: 'The expiry date is not right. Please check it and try again.',
  processing_error: 'Your bank could not process the payment. Please try again in a moment.',
  card_velocity_exceeded:
    'Your card has reached its limit. Please try another card, or call your bank.',
  withdrawal_count_limit_exceeded:
    'Your card has reached its limit. Please try another card, or call your bank.',
  authentication_required: VERIFY,
  payment_intent_authentication_failure: VERIFY,
  card_not_supported: 'This card does not support this kind of purchase. Please use another card.',
  currency_not_supported:
    'This card does not support payments in US dollars. Please use another card.',
};

export function paymentErrorMessage(error: PaymentErrorLike): string {
  if (error.type === 'validation_error') return error.message ?? 'Please check your card details.';
  const reason =
    (error.decline_code && BY_REASON[error.decline_code]) || (error.code && BY_REASON[error.code]);
  if (reason) return reason;
  if (error.type === 'card_error') return DECLINED;
  if (
    error.type === 'api_connection_error' ||
    error.type === 'api_error' ||
    error.type === 'rate_limit_error'
  )
    return 'We could not reach the payment service. Please try again.';
  return error.message ?? 'The payment did not go through. Please try again.';
}
