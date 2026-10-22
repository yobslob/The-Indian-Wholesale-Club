/** D-148: the 7-day days as words, "7" or "6 – 8" (both from Settings, never written in code: non-negotiable 4). */
export function quickDaysLabel(min: number, max: number): string {
  return min === max ? `${max}` : `${min} – ${max}`;
}
