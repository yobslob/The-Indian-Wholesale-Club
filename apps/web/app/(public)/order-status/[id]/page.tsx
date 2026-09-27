import { ArrowLeft, CheckCircle2, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SHIPPING_RATES, SITE_NAME, SUPPORT_EMAIL } from '@repo/shared/constants';
import { formatDate, formatUSD } from '@repo/shared/utils';
import { sanitizeTrackingEvent } from '@repo/shared/utils';

import { canViewOrder } from '@/lib/orders/access';
import { getOrderById } from '@/lib/queries/orders';
import { supabaseAdmin } from '@/lib/supabase/admin';


import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `Order Status & Tracking — ${SITE_NAME}`,
  description: 'Track your shipment status and delivery progress.',
  robots: {
    index: false,
    follow: false,
  },
};

interface OrderStatusPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    email?: string;
  }>;
}

function OrderVerifyPrompt({ id }: { id: string }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Order Lookup
        </span>
        <h1 className="font-display mt-1 text-xl font-bold tracking-tight text-neutral-900">
          Verify to view this order
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-neutral-600">
          For your protection, enter the email address used at checkout to see order details and
          delivery updates.
        </p>
        <form
          method="GET"
          action={`/order-status/${encodeURIComponent(id)}`}
          className="mt-5 space-y-3"
        >
          <label className="block text-xs font-medium text-neutral-700" htmlFor="order-email">
            Order email
          </label>
          <input
            id="order-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-200"
          />
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center rounded-md bg-neutral-900 px-5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
          >
            View Order Status
          </button>
        </form>
      </div>
    </div>
  );
}

const TIMELINE_STEPS = [
  { key: 'confirmed', label: 'Order Confirmed', desc: 'Order placed and payment authorized.' },
  {
    key: 'processing',
    label: 'Carrier Processing',
    desc: 'Items inspected, packaged, and prepared for carrier pickup.',
  },
  { key: 'shipped', label: 'In Transit', desc: 'Dispatched to US Regional Sorting Facility.' },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    desc: 'Package with local carrier for final destination delivery.',
  },
  { key: 'delivered', label: 'Delivered', desc: 'Package delivered to recipient address.' },
];

export default async function OrderStatusPage({
  params,
  searchParams,
}: OrderStatusPageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const { email: claimedEmail } = await searchParams;

  let order = null;
  // If UUID:
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    order = await getOrderById(supabaseAdmin, id);
  } else {
    // If order_number:
    const { data } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*), tracking_events(*)')
      .eq('order_number', id.trim())
      .single();

    if (data) {
      const { order_items, tracking_events, ...rest } = data;
      order = {
        ...rest,
        items: order_items || [],
        tracking_events: tracking_events || [],
      };
    }
  }

  if (!order) {
    notFound();
  }

  const allowed = await canViewOrder(order, claimedEmail);
  if (!allowed) {
    return <OrderVerifyPrompt id={id} />;
  }

  const shippingAddress =
    (order.shipping_address as {
      fullName?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    }) || {};

  // Determine active step index
  const activeTimelineIndex =
    order.status === 'delivered'
      ? 4
      : order.status === 'out_for_delivery'
        ? 3
        : order.status === 'shipped' || order.status === 'in_transit'
          ? 2
          : order.status === 'processing'
            ? 1
            : 0;

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 md:px-8 lg:px-12">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Store
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Shipment Status
            </span>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Order #{order.order_number}
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              Placed on {formatDate(order.created_at)} · Carrier:{' '}
              {order.carrier || 'USPS / Regional Carrier'}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs">
            <Clock className="h-4 w-4 text-emerald-700" />
            <div>
              <div className="font-semibold text-emerald-900">Estimated Delivery</div>
              <div className="text-emerald-700">
                {order.estimated_delivery_date
                  ? formatDate(order.estimated_delivery_date)
                  : SHIPPING_RATES.standard.windowLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Stepper */}
        <div className="mt-10 border-t border-neutral-100 pt-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-2">
            {TIMELINE_STEPS.map((step, idx) => {
              const isPast = idx <= activeTimelineIndex;
              const isCurrent = idx === activeTimelineIndex;

              return (
                <div key={step.key} className="flex flex-col">
                  <div className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        isPast ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'
                      } ${isCurrent ? 'ring-4 ring-neutral-200' : ''}`}
                    >
                      {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <div
                        className={`hidden h-0.5 flex-1 sm:block ${
                          idx < activeTimelineIndex ? 'bg-neutral-900' : 'bg-neutral-200'
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-3">
                    <div
                      className={`text-xs font-semibold ${
                        isPast ? 'text-neutral-900' : 'text-neutral-400'
                      }`}
                    >
                      {step.label}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Events Timeline on Left, Order Summary on Right */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Tracking Events List */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-bold text-neutral-900">Shipment Activity</h2>

            {order.tracking_events && order.tracking_events.length > 0 ? (
              <div className="relative mt-6 space-y-6 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-0.5 before:bg-neutral-200">
                {order.tracking_events.map((event) => {
                  const sanitized = sanitizeTrackingEvent({
                    rawStatus: event.status,
                    rawLocation: event.location,
                    rawDescription: event.description,
                    eventTimestamp: event.event_timestamp,
                  });

                  return (
                    <div key={event.id} className="relative">
                      <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-neutral-900 ring-2 ring-neutral-200" />
                      <div className="text-xs font-semibold text-neutral-900">
                        {sanitized.customerFacingStatus}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                        {sanitized.customerFacingDescription}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                        <span>
                          {formatDate(sanitized.eventTimestamp, {
                            hour: 'numeric',
                            minute: 'numeric',
                          })}
                        </span>
                        {sanitized.customerFacingLocation && (
                          <span>· {sanitized.customerFacingLocation}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600">
                Your order is currently processing at the fulfillment center. Detailed carrier
                milestones will populate as the package travels through the regional network.
              </div>
            )}
          </div>

          {/* Delivery Destination */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <MapPin className="h-3.5 w-3.5" />
              <span>Destination Address</span>
            </div>
            <div className="mt-3 text-xs leading-relaxed text-neutral-800">
              <div className="font-semibold text-neutral-900">{shippingAddress.fullName}</div>
              <div>{shippingAddress.line1}</div>
              {shippingAddress.line2 && <div>{shippingAddress.line2}</div>}
              <div>
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
              </div>
              <div>{shippingAddress.country || 'United States'}</div>
            </div>
          </div>
        </div>

        {/* Right Column: Items and Receipt */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-bold text-neutral-900">Ordered Items</h2>

            <ul className="mt-4 divide-y divide-neutral-200">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-3 text-xs">
                  <div className="pr-4">
                    <div className="font-semibold text-neutral-900">{item.product_name}</div>
                    {item.variant_label && (
                      <div className="text-[11px] text-neutral-500">{item.variant_label}</div>
                    )}
                    <div className="text-[11px] text-neutral-400">Qty: {item.quantity}</div>
                  </div>
                  <div className="font-medium text-neutral-900">
                    {formatUSD(item.total_price_cents / 100)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatUSD(order.subtotal_cents / 100)}</span>
              </div>
              {order.discount_cents > 0 && (
                <div className="text-destructive flex justify-between">
                  <span>Discount</span>
                  <span>-{formatUSD(order.discount_cents / 100)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>
                  {order.shipping_cents === 0 ? 'FREE' : formatUSD(order.shipping_cents / 100)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Sales Tax</span>
                <span>{formatUSD(order.tax_cents / 100)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-sm font-bold text-neutral-900">
                <span>Total Paid</span>
                <span className="font-display">{formatUSD(order.total_cents / 100)}</span>
              </div>
            </div>
          </div>

          {/* Need Assistance Block */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-6 text-xs text-neutral-600">
            <h3 className="text-sm font-semibold text-neutral-900">Need help with this order?</h3>
            <p className="mt-1 leading-relaxed">
              If you have any questions regarding delivery, sizing, or exchanges, our customer
              support team is available Monday through Friday.
            </p>
            <div className="mt-3">
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Inquiry on Order ${order.order_number}`}
                className="text-primary font-medium underline underline-offset-2 hover:text-neutral-700"
              >
                Contact Customer Care ({SUPPORT_EMAIL})
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
