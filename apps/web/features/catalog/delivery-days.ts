/** "7 delivery days", "12 – 16 delivery days" (D-187: store pages say the term, no calendar date); null without days. */
export function deliveryDaysLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null || max == null) return null;
  return min === max ? `${max} delivery days` : `${min} – ${max} delivery days`;
}
