/** The promise by product type, in the customer's words (D-187). Pure, so it has unit tests. */
export interface DeliveryLines {
  food: string | null;
  standard: string | null;
}

/** "7 delivery days" or "12 – 16 delivery days" from Settings' days (non-negotiable 4); null while either is unset. */
export function deliveryDaysLine(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min === null || min === undefined || max === null || max === undefined) return null;
  return min === max ? `${max} delivery days` : `${min} – ${max} delivery days`;
}
