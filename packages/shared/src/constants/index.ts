export const SITE_NAME = 'ROOT';
export const SITE_DESCRIPTION = 'Premium essentials for the modern wardrobe.';

// L6: contact address is configurable via env instead of a hard-coded
// placeholder. NEXT_PUBLIC_CONTACT_EMAIL (inlined into client bundles such as
// the footer) wins over the server-side CONTACT_EMAIL; the guard keeps this
// safe in runtimes without a `process` global (browser, edge).
const CONFIGURED_CONTACT_EMAIL =
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env.NEXT_PUBLIC_CONTACT_EMAIL || process.env.CONTACT_EMAIL)) ||
  '';

export const SUPPORT_EMAIL: string = CONFIGURED_CONTACT_EMAIL || 'support@root.com';

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPPING_RATES = {
  standard: {
    label: 'Standard Shipping (5-7 business days)',
    windowLabel: '5-7 business days',
    windowDays: [5, 7] as [number, number],
    price: 5.99,
    minOrder: 0,
  },
  express: {
    label: 'Express Shipping (2-3 business days)',
    windowLabel: '2-3 business days',
    windowDays: [2, 3] as [number, number],
    price: 12.99,
    minOrder: 0,
  },
  freeThreshold: 75,
} as const;

export const DEFAULT_SHIPPING_CENTS = 599;
export const FREE_SHIPPING_THRESHOLD_CENTS = 7500;

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
] as const;

export type USStateCode = (typeof US_STATES)[number]['code'];
