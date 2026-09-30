import { getMyOrder } from '@repo/db/store';

import { LookupForm } from '@/features/orders/lookup-form';
import { OrderView } from '@/features/orders/order-view';
import { currentUser, sessionClient } from '@/lib/supabase/server';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your order', robots: { index: false } };

type Params = Promise<{ number: string }>;

/**
 * Signed-in customers see their own order directly (store_my_order). Anyone
 * else must confirm the order email first (guest lookup), so knowing an order
 * number alone reveals nothing.
 */
export default async function OrderPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const orderNumber = decodeURIComponent((await params).number).toUpperCase();
  const client = await sessionClient();
  const order = (await currentUser(client)) ? await getMyOrder(client, orderNumber) : null;

  return (
    <div className="space-y-6">
      <h1 className="font-hero text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Your order</h1>
      {order ? <OrderView order={order} /> : <LookupForm defaultNumber={orderNumber} />}
    </div>
  );
}
