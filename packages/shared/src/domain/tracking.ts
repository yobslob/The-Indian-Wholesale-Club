/**
 * Carriers with a tracking link: USPS, UPS and FedEx in the US (D-066), DHL for express from India (D-070). The US
 * carrier is not chosen yet (Q-3); an admin picks one of these or types another, whose number is shown without a link.
 */
export const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL'] as const;
export type Carrier = (typeof CARRIERS)[number];

const TRACKING_URL: Record<Carrier, (number: string) => string> = {
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  UPS: (n) => `https://www.ups.com/track?tracknum=${n}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  // DHL Express carries most express parcels from India (D-070).
  DHL: (n) => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`,
};

/** The carrier's public tracking page for a number, or null for other carriers or an empty number. */
export function trackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  const number = trackingNumber?.replace(/\s+/g, '') ?? '';
  const known = CARRIERS.find((c) => c.toLowerCase() === carrier?.trim().toLowerCase());
  if (!known || !/^[A-Za-z0-9]{4,40}$/.test(number)) return null;
  return TRACKING_URL[known](encodeURIComponent(number));
}
