const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** Shop prices and payouts are in paise (INR, integer). Admin screens only (D-003). */
export function rupees(paise: number | null | undefined): string {
  return paise === null || paise === undefined ? '—' : inr.format(paise / 100);
}
