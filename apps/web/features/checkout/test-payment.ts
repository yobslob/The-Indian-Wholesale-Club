/**
 * The admin's $1 payment test (admin.md §Payment test): its PaymentIntents carry this kind, so the Stripe webhook
 * leaves them alone (no order, no "Paid, but no order" alert) and only the test page can refund them.
 */
export const TEST_PAYMENT_KIND = 'admin_test';
export const TEST_PAYMENT_CENTS = 100;
