const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/** Admin timestamps in UTC, like the web panel (cutoffs are entered in UTC). */
export function utc(iso: string | null | undefined): string {
  return iso ? `${dateTime.format(new Date(iso))} UTC` : '—';
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

/** Shop prices and payouts are in paise (INR, integer). Admin screens only (D-003). */
export function rupees(paise: number | null | undefined): string {
  return paise === null || paise === undefined ? '—' : inr.format(paise / 100);
}
