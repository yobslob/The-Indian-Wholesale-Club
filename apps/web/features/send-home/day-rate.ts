import 'server-only';

import { setSendHomeRate } from '@repo/db/server';

import type { IwcClient } from '@repo/db';

/**
 * D-206: the day's US dollar to Indian rupee rate, the European Central Bank's reference rate through Frankfurter (free,
 * no key; Claude's proposed source, D-206's interpretation). Written with set_send_home_rate, which refuses a rate out of
 * range or 10% from the last, so one bad answer never prices gifts.
 */
export const RATE_SOURCE = 'https://api.frankfurter.app/latest?from=USD&to=INR';

export async function checkDayRate(client: IwcClient): Promise<number> {
  const res = await fetch(RATE_SOURCE, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`rate source answered ${res.status}`);
  const body = (await res.json()) as { rates?: { INR?: unknown } };
  const rate = body.rates?.INR;
  if (typeof rate !== 'number' || !Number.isFinite(rate)) throw new Error('rate source sent no INR rate');
  await setSendHomeRate(client, rate);
  return rate;
}
