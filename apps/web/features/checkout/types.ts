/** The checkout HTTP contract lives in @repo/shared (the app uses it too). */
export type {
  CheckoutErrorResponse,
  CheckoutProblem,
  CheckoutQuote,
  CheckoutRequestBody,
  CheckoutStartResponse,
  DeliveryDates,
  FinalizeResponse,
  QuotedLine,
} from '@repo/shared/domain';

/** D-114: a signed-in customer's saved address, as checkout offers it. */
export interface SavedAddress {
  id: string;
  label: string | null;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  isDefault: boolean;
}

/** D-114: what checkout fills in for a signed-in customer (null for a guest). */
export interface SavedDetails {
  email: string | null;
  addresses: SavedAddress[];
}
