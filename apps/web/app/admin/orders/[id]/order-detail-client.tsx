'use client';

import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Plus,
  Shield,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

import { sanitizeTrackingEvent } from '@repo/shared/utils';

import { StatusBadge, StealthPreviewCard } from '@/components/admin';

import type {
  OrderStatusEnum,
  OrderWithFullDetails,
  SanitizedTrackingEvent,
} from '@repo/shared/types';

interface OrderDetailClientProps {
  initialOrder: OrderWithFullDetails;
}

export function OrderDetailClient({ initialOrder }: OrderDetailClientProps): React.JSX.Element {
  const [order, setOrder] = useState<OrderWithFullDetails>(initialOrder);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatusEnum>(order.status);
  const [trackingCode, setTrackingCode] = useState<string>(order.tracking_code || '');
  const [carrier, setCarrier] = useState<string>(order.carrier || 'Standard Courier');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  // Manual tracking event form state
  const [newEventStatus, setNewEventStatus] = useState<string>(
    'Package processing at regional hub',
  );
  const [newEventLocation, setNewEventLocation] = useState<string>('Delhi Air Cargo Hub');
  const [newEventDesc, setNewEventDesc] = useState<string>('International outbound linehaul scan');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState<boolean>(false);
  const [previewEvent, setPreviewEvent] = useState<SanitizedTrackingEvent>(
    sanitizeTrackingEvent({
      rawStatus: newEventStatus,
      rawLocation: newEventLocation,
      rawDescription: newEventDesc,
    }),
  );

  const handlePreviewUpdate = (statusVal: string, locVal: string, descVal: string): void => {
    setNewEventStatus(statusVal);
    setNewEventLocation(locVal);
    setNewEventDesc(descVal);
    setPreviewEvent(
      sanitizeTrackingEvent({
        rawStatus: statusVal,
        rawLocation: locVal,
        rawDescription: descVal,
      }),
    );
  };

  const handleUpdateStatus = async (): Promise<void> => {
    setIsUpdatingStatus(true);
    setStatusToast(null);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          trackingCode: trackingCode || null,
          carrier: carrier || null,
        }),
      });

      if (res.ok) {
        setStatusToast({ kind: 'success', message: 'Order status updated successfully!' });
        setOrder((prev) => ({
          ...prev,
          status: selectedStatus,
          tracking_code: trackingCode || null,
          carrier: carrier || null,
        }));
        setTimeout(() => setStatusToast(null), 3000);
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatusToast({
          kind: 'error',
          message: err?.error || 'Failed to update order',
        });
        // Roll back the pending selection so the UI matches persisted state (L8).
        setSelectedStatus(order.status);
        setTrackingCode(order.tracking_code || '');
        setCarrier(order.carrier || 'Standard Courier');
      }
    } catch {
      setStatusToast({ kind: 'error', message: 'Network error updating status' });
      setSelectedStatus(order.status);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddTrackingEvent = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmittingEvent(true);
    try {
      const res = await fetch('/api/admin/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: newEventStatus,
          rawLocation: newEventLocation,
          rawDescription: newEventDesc,
        }),
      });

      if (res.ok) {
        // Refresh local tracking events
        const fetchRes = await fetch(`/api/admin/orders/${order.id}`);
        if (fetchRes.ok) {
          const updated = await fetchRes.json();
          setOrder(updated);
        }
      }
    } catch (err) {
      console.error('[Add Tracking Event] error:', err);
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const addr = (order.shipping_address as Record<string, unknown>) || {};
  const customerName = (addr.fullName as string) || (addr.full_name as string) || 'Valued Customer';
  const customerEmail = (addr.email as string) || 'guest@example.com';
  const customerPhone = (addr.phone as string) || '';

  return (
    <div className="space-y-6">
      {/* Top Navigation & Order Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Orders List
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-2xl font-bold tracking-tight text-zinc-900">
              {order.order_number}
            </h2>
            <StatusBadge status={order.status} type="order" />
            <StatusBadge status={order.payment_status} type="payment" />
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Placed on{' '}
            {new Date(order.created_at).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/order-status/${order.order_number}`}
            target="_blank"
            className="shadow-2xs flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
            Customer Tracking View
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Items, Breakdown, Customer Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Items Table */}
          <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Package className="h-4 w-4 text-zinc-500" />
                Purchased Line Items ({order.items.length})
              </h3>
            </div>

            <div className="divide-y divide-zinc-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{item.product_name}</div>
                    {item.variant_label && (
                      <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                        {item.variant_label}
                      </div>
                    )}
                    <div className="mt-1 text-zinc-400">
                      Qty: <span className="font-bold text-zinc-700">{item.quantity}</span> × $
                      {(item.unit_price_cents / 100).toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right font-mono text-sm font-bold text-zinc-900">
                    ${(item.total_price_cents / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Breakdown */}
            <div className="space-y-2 border-t border-zinc-200 bg-zinc-50 p-4 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono">${(order.subtotal_cents / 100).toFixed(2)}</span>
              </div>
              {order.discount_cents > 0 && (
                <div className="flex justify-between font-medium text-emerald-600">
                  <span>Discount</span>
                  <span className="font-mono">-${(order.discount_cents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600">
                <span>Shipping</span>
                <span className="font-mono">
                  {order.shipping_cents === 0
                    ? 'FREE'
                    : `$${(order.shipping_cents / 100).toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Estimated Tax (US)</span>
                <span className="font-mono">${(order.tax_cents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-900">
                <span>Total Amount Paid</span>
                <span className="font-mono">${(order.total_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Customer & Shipping Information */}
          <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="flex items-center gap-2 border-b border-zinc-100 pb-3 text-sm font-semibold text-zinc-900">
              <MapPin className="h-4 w-4 text-zinc-500" />
              Delivery Destination & Customer Contact
            </h3>

            <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Customer
                </span>
                <div className="mt-1 font-semibold text-zinc-900">{customerName}</div>
                <div className="mt-0.5 font-mono text-zinc-500">{customerEmail}</div>
                {customerPhone && <div className="mt-0.5 text-zinc-500">{customerPhone}</div>}
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Shipping Address (US Format)
                </span>
                <div className="mt-1 leading-relaxed text-zinc-800">
                  <div>{(addr.line1 as string) || ''}</div>
                  {Boolean(addr.line2) && <div>{String(addr.line2)}</div>}
                  <div>
                    {(addr.city as string) || ''}, {(addr.state as string) || ''}{' '}
                    {(addr.zipCode as string) || (addr.zip_code as string) || ''}
                  </div>
                  <div className="font-semibold text-zinc-900">United States</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Status Transitions & Stealth Tracking Logger */}
        <div className="space-y-6">
          {/* Order Lifecycle Controller */}
          <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="flex items-center gap-2 border-b border-zinc-100 pb-3 text-sm font-semibold text-zinc-900">
              <Truck className="h-4 w-4 text-zinc-500" />
              Fulfillment & Lifecycle Controls
            </h3>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                  Order Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatusEnum)}
                  className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs font-semibold focus:bg-white"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing & Quality Inspection</option>
                  <option value="shipped">Shipped</option>
                  <option value="in_transit">In Transit</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                  Tracking Code
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="e.g. 9400100000000000000000"
                  className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                  Domestic Carrier Label
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="USPS Ground Advantage / FedEx Regional"
                  className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs focus:bg-white"
                />
              </div>

              {statusToast && (
                <div
                  role="status"
                  className={`rounded-lg border p-2 text-center text-xs font-medium ${
                    statusToast.kind === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {statusToast.message}
                </div>
              )}

              <button
                type="button"
                onClick={handleUpdateStatus}
                disabled={isUpdatingStatus}
                className="shadow-xs flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                {isUpdatingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Save Status Changes
              </button>
            </div>
          </div>

          {/* Stealth Tracking Event Logger */}
          <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Shield className="h-4 w-4 text-emerald-600" />
                Log Tracking Event
              </h3>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Auto-Sanitized
              </span>
            </div>

            <form onSubmit={handleAddTrackingEvent} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                  Raw Status / Event
                </label>
                <input
                  type="text"
                  value={newEventStatus}
                  onChange={(e) =>
                    handlePreviewUpdate(e.target.value, newEventLocation, newEventDesc)
                  }
                  required
                  placeholder="e.g. Customs Clearance Complete"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                  Raw Origin Location
                </label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(e) =>
                    handlePreviewUpdate(newEventStatus, e.target.value, newEventDesc)
                  }
                  placeholder="e.g. Delhi Air Cargo Terminal"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                  Raw Carrier Notes
                </label>
                <input
                  type="text"
                  value={newEventDesc}
                  onChange={(e) =>
                    handlePreviewUpdate(newEventStatus, newEventLocation, e.target.value)
                  }
                  placeholder="e.g. Departed international sorting center"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs"
                />
              </div>

              {/* Real-time stealth preview */}
              <div className="pt-2">
                <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-400">
                  Live Sanitization Preview:
                </span>
                <StealthPreviewCard event={previewEvent} />
              </div>

              <button
                type="submit"
                disabled={isSubmittingEvent}
                className="shadow-xs mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                {isSubmittingEvent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Post Sanitized Tracking Event
              </button>
            </form>
          </div>

          {/* Tracking History Timeline */}
          <div className="shadow-xs space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="border-b border-zinc-100 pb-3 text-sm font-semibold text-zinc-900">
              Recorded Tracking Events ({order.tracking_events?.length || 0})
            </h3>

            {!order.tracking_events || order.tracking_events.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                No tracking events logged yet for this order.
              </div>
            ) : (
              <div className="space-y-4">
                {order.tracking_events.map((evt) => (
                  <div key={evt.id} className="relative space-y-1 border-l-2 border-zinc-200 pl-5">
                    <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-zinc-900" />
                    <div className="text-xs font-bold text-zinc-900">
                      {evt.customer_facing_status || evt.status}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      📍 {evt.location || 'Regional Facility'}
                    </div>
                    {evt.description && (
                      <div className="text-xs text-zinc-600">{evt.description}</div>
                    )}
                    <div className="font-mono text-[10px] text-zinc-400">
                      {new Date(evt.event_timestamp).toLocaleString('en-US', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
