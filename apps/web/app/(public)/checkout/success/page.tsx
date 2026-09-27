import {
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import Link from 'next/link';

import { SHIPPING_RATES, SITE_NAME, SUPPORT_EMAIL } from '@repo/shared/constants';
import { formatDate, formatUSD } from '@repo/shared/utils';

import { canViewOrder } from '@/lib/orders/access';
import { supabaseAdmin } from '@/lib/supabase/admin';

import type { OrderItem } from '@repo/shared/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: `Order Confirmed — ${SITE_NAME}`,
  description: 'Thank you for your order.',
  robots: {
    index: false,
    follow: false,
  },
};

interface OrderSuccessPageProps {
  searchParams: Promise<{
    order_number?: string;
    email?: string;
  }>;
}

export default async function OrderSuccessPage({
  searchParams,
}: OrderSuccessPageProps): Promise<React.JSX.Element> {
  const { order_number, email: claimedEmail } = await searchParams;

  let order = null;
  let items: OrderItem[] = [];
  let orderVisible = false;

  if (order_number) {
    const { data } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_number', order_number.trim())
      .single();

    if (data) {
      const { order_items, ...rest } = data;
      order = rest;
      items = (order_items as OrderItem[]) || [];
      orderVisible = await canViewOrder(order, claimedEmail);
    }
  }

  if (order && !orderVisible) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Order Confirmation
          </span>
          <h1 className="font-display mt-1 text-xl font-bold text-neutral-900">
            Verify to view this order
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">
            Enter the email address used at checkout to view your receipt and order details.
          </p>
          <form method="GET" action="/checkout/success" className="mt-5 space-y-3 text-left">
            <input
              type="hidden"
              name="order_number"
              value={order.order_number ?? order_number ?? ''}
            />
            <label className="block text-xs font-medium text-neutral-700" htmlFor="verify-email">
              Order email
            </label>
            <input
              id="verify-email"
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
              View Order Confirmation
            </button>
          </form>
        </div>
      </div>
    );
  }

  const shippingAddress =
    (order?.shipping_address as {
      fullName?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      email?: string;
    }) || {};

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-12 md:px-8 lg:px-12">
      {/* Success Hero */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
        </div>

        <p className="mt-4 font-mono text-xs font-semibold uppercase tracking-widest text-emerald-700">
          Payment Successful
        </p>

        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Thank you for your order
        </h1>

        <p className="mx-auto mt-3 max-w-lg text-sm text-neutral-600">
          We&apos;ve received your order and sent a confirmation receipt to{' '}
          <span className="font-semibold text-neutral-900">
            {shippingAddress.email || 'your email'}
          </span>
          .
        </p>

        {order && (
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-5 py-2 text-xs">
            <span className="font-semibold uppercase text-neutral-500">Order Number</span>
            <span className="font-mono font-bold text-neutral-900">#{order.order_number}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Details on Left, Summary on Right */}
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Left Column: Delivery & Tracking Timeline */}
        <div className="space-y-8 lg:col-span-7">
          {/* Tracking Milestone Card */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Truck className="h-5 w-5 text-neutral-800" />
                <h2 className="text-sm font-semibold text-neutral-900">Estimated Delivery</h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {order?.estimated_delivery_date
                    ? formatDate(order.estimated_delivery_date)
                    : SHIPPING_RATES.standard.windowLabel}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-900">Order Confirmed</div>
                  <div className="text-[11px] text-neutral-500">
                    Your order details have been verified and routed to packaging.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
                  <Package className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-700">Carrier Processing</div>
                  <div className="text-[11px] text-neutral-500">
                    Preparing shipment with US carrier. Tracking ID will be generated upon dispatch.
                  </div>
                </div>
              </div>
            </div>

            {order && (
              <div className="mt-6 border-t border-neutral-100 pt-4">
                <Link
                  href={`/order-status/${order.id}?email=${encodeURIComponent(
                    claimedEmail || shippingAddress.email || '',
                  )}`}
                  className="text-primary inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider underline underline-offset-4 hover:text-neutral-700"
                >
                  View Live Tracking Timeline <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Shipping & Payment Destination */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 text-xs shadow-sm">
              <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-neutral-500">
                <MapPin className="h-3.5 w-3.5" />
                <span>Shipping Destination</span>
              </div>
              <div className="mt-3 leading-relaxed text-neutral-800">
                <div className="font-semibold text-neutral-900">
                  {shippingAddress.fullName || 'Customer'}
                </div>
                <div>{shippingAddress.line1}</div>
                {shippingAddress.line2 && <div>{shippingAddress.line2}</div>}
                <div>
                  {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
                </div>
                <div>{shippingAddress.country || 'United States'}</div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 text-xs shadow-sm">
              <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-neutral-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Payment Method</span>
              </div>
              <div className="mt-3 leading-relaxed text-neutral-800">
                <div className="font-semibold text-neutral-900">Credit / Debit Card</div>
                <div className="text-neutral-500">Payment Status: Confirmed</div>
                <div className="mt-2 text-neutral-500">
                  Carrier: {order?.carrier || 'USPS / Regional Carrier'}
                </div>
              </div>
            </div>
          </div>

          {/* Guest Account Upsell Prompt */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-6 text-xs text-neutral-600">
            <h3 className="text-sm font-semibold text-neutral-900">
              Save your details for your next visit
            </h3>
            <p className="mt-1 leading-relaxed">
              Create a complimentary ROOT account with{' '}
              <span className="font-semibold text-neutral-900">
                {shippingAddress.email || 'your email'}
              </span>{' '}
              to track this order, store your shipping addresses, and enjoy faster checkout.
            </p>
            <div className="mt-4">
              <Link
                href={`/signup?email=${encodeURIComponent(shippingAddress.email || '')}`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-neutral-900 px-5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Order Items & Receipt Summary */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-bold text-neutral-900">Order Receipt</h2>

            {items.length > 0 ? (
              <ul className="mt-4 divide-y divide-neutral-200">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-3 text-xs">
                    <div className="flex-1 pr-4">
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
            ) : (
              <p className="mt-4 text-xs text-neutral-500">Order items summary available</p>
            )}

            {/* Financial Breakdown */}
            {order && (
              <div className="mt-6 space-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium text-neutral-900">
                    {formatUSD(order.subtotal_cents / 100)}
                  </span>
                </div>
                {order.discount_cents > 0 && (
                  <div className="text-destructive flex justify-between">
                    <span>Discount</span>
                    <span className="font-semibold">-{formatUSD(order.discount_cents / 100)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-medium text-neutral-900">
                    {order.shipping_cents === 0 ? 'FREE' : formatUSD(order.shipping_cents / 100)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Sales Tax</span>
                  <span className="font-medium text-neutral-900">
                    {formatUSD(order.tax_cents / 100)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-sm font-bold text-neutral-900">
                  <span>Total Paid</span>
                  <span className="font-display text-base">
                    {formatUSD(order.total_cents / 100)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-8 border-t border-neutral-100 pt-6">
              <Link
                href="/shop"
                className="flex h-11 w-full items-center justify-center rounded-md bg-neutral-900 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
              >
                Continue Shopping
              </Link>
            </div>

            <div className="mt-4 text-center text-[11px] text-neutral-400">
              Need assistance? Email{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-neutral-700 underline underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
