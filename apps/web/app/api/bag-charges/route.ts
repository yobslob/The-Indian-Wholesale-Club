import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getBagCharges } from '@repo/db/store';

import { storeClient } from '@/lib/supabase/store';

const itemsParam = z
  .string()
  .max(50 * 40)
  .transform((v) => v.split(',').filter(Boolean))
  .pipe(z.array(z.string().regex(/^[0-9a-f-]{36}:\d{1,2}$/)).max(50))
  .transform((list) =>
    list.map((i) => ({ variantId: i.slice(0, 36), quantity: Number(i.slice(37)) })),
  );

/**
 * D-111: the bag's small-order charges (`?items=<variant id>:<quantity>,…`), for the bag, the free-delivery bar and the
 * app. Worked out in the database where the weights are (INV-1); only the charges and the free-shipping line come
 * back. The same bag always gets the same answer until a setting changes, so it is cached for a minute. D-148, D-154:
 * `quick` is the 7-day days when the whole bag is one 7-day shipment (only 7-day pieces, worth the 7-day line), null
 * otherwise; `shipments` says the rest (the line, the gap, a split). Never which shop decides it.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const items = itemsParam.safeParse(new URL(request.url).searchParams.get('items') ?? '');
  if (!items.success)
    return NextResponse.json(
      { error: 'items: <variant id>:<quantity>, comma separated' },
      { status: 400 },
    );
  try {
    const charges = await getBagCharges(storeClient(), items.data);
    const s = charges.shipments;
    const quick = s?.quick_only ? { days_min: s.days_min, days_max: s.days_max } : null;
    return NextResponse.json(
      { ...charges, quick },
      {
        headers: {
          'cache-control': 'public, max-age=60, s-maxage=60',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Charges are not available right now.' }, { status: 503 });
  }
}
