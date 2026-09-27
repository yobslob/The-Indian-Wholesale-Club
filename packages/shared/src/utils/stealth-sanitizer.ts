import type { CustomerFacingMilestone, OrderStatusEnum, SanitizedTrackingEvent } from '../types';

/**
 * Known foreign geographic terms to strip or replace with US domestic hub terminology.
 */
const FOREIGN_LOCATIONS_REGEX = new RegExp(
  '\\b(' +
    [
      'india',
      'ind',
      'delhi',
      'new delhi',
      'mumbai',
      'bombay',
      'bengaluru',
      'bangalore',
      'chennai',
      'madras',
      'kolkata',
      'calcutta',
      'hyderabad',
      'ahmedabad',
      'pune',
      'surat',
      'jaipur',
      'tirupur',
      'noida',
      'gurgaon',
      'gurugram',
      'haryana',
      'punjab',
      'tamil nadu',
      'karnataka',
      'maharashtra',
      'gujarat',
      'igi airport',
      'del',
      'bom',
      'blr',
      'maa',
      'ccu',
      'cross-border',
      'international',
      'overseas',
      'customs bonded',
      'air cargo complex',
    ].join('|') +
    ')\\b',
  'gi',
);

/**
 * Terminology replacement rules to convert international customs / freight terms
 * into domestic, standard e-commerce delivery language.
 */
const TERMINOLOGY_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern:
      /\b(customs clearance|customs inspection|customs release|customs held|customs entry|customs scan)\b/gi,
    replacement: 'Package processing at regional hub',
  },
  {
    pattern: /\b(export scan|outward clearance|origin scan|carrier picked up at origin)\b/gi,
    replacement: 'Carrier processing',
  },
  {
    pattern:
      /\b(international shipment|cross-border transit|international linehaul|flight departed|air freight)\b/gi,
    replacement: 'Shipment in transit to distribution center',
  },
  {
    pattern: /\b(import clearance|customs broker|port of entry)\b/gi,
    replacement: 'Arrived at regional distribution facility',
  },
  {
    pattern: /\b(handover to linehaul|transshipment hub)\b/gi,
    replacement: 'Transferring between regional facilities',
  },
];

/**
 * Sanitize raw carrier tracking events to conceal foreign origins and present
 * a seamless US-native fulfillment journey.
 */
export function sanitizeTrackingEvent(input: {
  rawStatus: string;
  rawLocation?: string | null;
  rawDescription?: string | null;
  eventTimestamp?: string;
}): SanitizedTrackingEvent {
  const { rawStatus, rawLocation, rawDescription, eventTimestamp } = input;

  let sanitizedLocation = rawLocation ? rawLocation.trim() : '';
  let sanitizedDescription = rawDescription ? rawDescription.trim() : '';
  let flaggedForReview = false;

  // 1. Sanitize location
  if (sanitizedLocation) {
    if (FOREIGN_LOCATIONS_REGEX.test(sanitizedLocation)) {
      sanitizedLocation = 'Carrier Regional Hub';
    }
    FOREIGN_LOCATIONS_REGEX.lastIndex = 0;
  } else {
    sanitizedLocation = 'Carrier Regional Hub';
  }

  // 2. Sanitize description
  if (sanitizedDescription) {
    TERMINOLOGY_REPLACEMENTS.forEach(({ pattern, replacement }) => {
      sanitizedDescription = sanitizedDescription.replace(pattern, replacement);
    });

    if (FOREIGN_LOCATIONS_REGEX.test(sanitizedDescription)) {
      sanitizedDescription = sanitizedDescription.replace(FOREIGN_LOCATIONS_REGEX, 'Regional Hub');
      flaggedForReview = true;
    }
    FOREIGN_LOCATIONS_REGEX.lastIndex = 0;
  }

  // 3. Map status to customer-facing milestone
  const lowerStatus = rawStatus.toLowerCase();
  let customerFacingStatus: CustomerFacingMilestone = 'In Transit';

  if (
    lowerStatus.includes('delivered') ||
    lowerStatus.includes('package delivered') ||
    lowerStatus.includes('completed')
  ) {
    customerFacingStatus = 'Delivered';
  } else if (
    lowerStatus.includes('out for delivery') ||
    lowerStatus.includes('with courier') ||
    lowerStatus.includes('loaded on delivery vehicle')
  ) {
    customerFacingStatus = 'Out for Delivery';
  } else if (
    lowerStatus.includes('confirmed') ||
    lowerStatus.includes('order placed') ||
    lowerStatus.includes('payment received')
  ) {
    customerFacingStatus = 'Order Confirmed';
  } else if (
    lowerStatus.includes('processing') ||
    lowerStatus.includes('manifest') ||
    lowerStatus.includes('picked') ||
    lowerStatus.includes('quality') ||
    lowerStatus.includes('packed')
  ) {
    customerFacingStatus = 'Processing & Quality Inspection';
  } else if (
    lowerStatus.includes('exception') ||
    lowerStatus.includes('delay') ||
    lowerStatus.includes('hold') ||
    lowerStatus.includes('weather')
  ) {
    customerFacingStatus = 'Exception / Hub Delay';
  } else {
    customerFacingStatus = 'In Transit';
  }

  // Final sanity sweep to guarantee zero leakage
  const foreignLeakTest =
    FOREIGN_LOCATIONS_REGEX.test(sanitizedLocation) ||
    FOREIGN_LOCATIONS_REGEX.test(sanitizedDescription);
  FOREIGN_LOCATIONS_REGEX.lastIndex = 0;

  if (foreignLeakTest) {
    sanitizedLocation = 'Carrier Regional Hub';
    sanitizedDescription = 'Shipment processing through regional hub';
    flaggedForReview = true;
  }

  return {
    rawStatus,
    rawLocation: rawLocation ?? null,
    rawDescription: rawDescription ?? null,
    sanitizedStatus: customerFacingStatus,
    sanitizedLocation,
    sanitizedDescription: sanitizedDescription || 'Shipment in transit through logistics network',
    customerFacingStatus,
    customerFacingLocation: sanitizedLocation,
    customerFacingDescription:
      sanitizedDescription || 'Shipment in transit through logistics network',
    customerFacingMilestone: customerFacingStatus,
    isOriginConcealed: true,
    flaggedForReview,
    eventTimestamp: eventTimestamp ?? new Date().toISOString(),
  };
}

/**
 * Map customer facing tracking milestone to PostgreSQL order_status_enum.
 * Returns null when the milestone is unknown - callers must NOT advance
 * the order status in that case (no silent default to in_transit).
 */
export function mapTrackingMilestoneToOrderStatus(
  milestone: CustomerFacingMilestone | string,
): OrderStatusEnum | null {
  switch (milestone) {
    case 'Order Confirmed':
      return 'confirmed';
    case 'Processing & Quality Inspection':
      return 'processing';
    case 'In Transit':
      return 'in_transit';
    case 'Out for Delivery':
      return 'out_for_delivery';
    case 'Delivered':
      return 'delivered';
    case 'Exception / Hub Delay':
      return 'in_transit';
    default:
      return null;
  }
}
