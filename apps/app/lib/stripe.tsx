/**
 * Stripe on phones (iOS, Android). lib/stripe.web.tsx stands in on the web build, which exists only so the app's
 * look can be previewed in a browser during development; checkout runs in the phone app.
 */
export { PaymentSheetError, StripeProvider, useStripe } from '@stripe/stripe-react-native';
