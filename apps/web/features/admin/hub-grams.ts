import { z } from 'zod';

const grams = z.coerce.number().int('Whole grams.').min(1, 'At least 1 g.').max(50_000, 'At most 50 kg.');

/** The grams typed at the hub (one piece, packed), or null when left empty (D-130). */
export function gramsFrom(form: FormData | undefined): number | null {
  const raw = form?.get('grams');
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  return grams.parse(raw);
}
