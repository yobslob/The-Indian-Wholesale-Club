/**
 * Web stand-in for @stripe/stripe-react-native (it has no web build). The web build is a development preview of
 * the app's look only: paying is refused with a plain message; customers pay in the phone app or on the website.
 */
export enum PaymentSheetError {
  Canceled = 'Canceled',
  Failed = 'Failed',
  Timeout = 'Timeout',
}

export function StripeProvider({ children }: { children: React.ReactElement | React.ReactElement[] }): React.JSX.Element {
  return <>{children}</>;
}

const unavailable = { error: { code: PaymentSheetError.Failed, message: 'Payment works in the phone app.' } };

export function useStripe(): {
  initPaymentSheet: (options: unknown) => Promise<typeof unavailable>;
  presentPaymentSheet: () => Promise<typeof unavailable>;
} {
  return {
    initPaymentSheet: async () => unavailable,
    presentPaymentSheet: async () => unavailable,
  };
}
