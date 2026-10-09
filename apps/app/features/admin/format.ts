
/** Shop prices and payouts are in paise (INR, integer). Admin screens only (D-003). */
export function rupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
}
