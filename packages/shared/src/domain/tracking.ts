/**
 * US carriers with a tracking link (D-066). The carrier is not chosen yet (Q-3); an admin picks one of these or types
 * another, whose number is shown without a link.
 */
export const CARRIERS = ['USPS', 'UPS', 'FedEx'] as const;
export type Carrier = (typeof CARRIERS)[number];

const TRACKING_URL: Record<Carrier, (number: string) => string> = {
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  UPS: (n) => `https://www.ups.com/track?tracknum=${n}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
};

/** The carrier's public tracking page for a number, or null for other carriers or an empty number. */
export function trackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  const number = trackingNumber?.replace(/\s+/g, '') ?? '';
  const known = CARRIERS.find((c) => c.toLowerCase() === carrier?.trim().toLowerCase());
  if (!known || !/^[A-Za-z0-9]{4,40}$/.test(number)) return null;
  return TRACKING_URL[known](encodeURIComponent(number));
}
