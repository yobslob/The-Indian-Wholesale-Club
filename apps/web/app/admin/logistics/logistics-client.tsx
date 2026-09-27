'use client';

import { Shield, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

import { sanitizeTrackingEvent } from '@repo/shared/utils';

import { StatusBadge, StealthPreviewCard } from '@/components/admin';

import type { AdminOrderListItem, SanitizedTrackingEvent, TrackingEvent } from '@repo/shared/types';

interface LogisticsClientProps {
  initialActiveShipments: AdminOrderListItem[];
  initialRecentEvents: TrackingEvent[];
  stats: {
    totalInTransit: number;
    deliveredCount: number;
    delayedCount: number;
    flaggedScansCount: number;
  };
}

export function LogisticsClient({
  initialActiveShipments,
  initialRecentEvents,
  stats,
}: LogisticsClientProps): React.JSX.Element {
  // Simulator state
  const [simRawStatus, setSimRawStatus] = useState<string>('Customs Export Clearance Completed');
  const [simRawLoc, setSimRawLoc] = useState<string>(
    'IGI Airport Cargo Terminal, New Delhi, India',
  );
  const [simRawDesc, setSimRawDesc] = useState<string>(
    'International shipment handed over to linehaul carrier after customs inspection',
  );

  const [simulatedResult, setSimulatedResult] = useState<SanitizedTrackingEvent>(
    sanitizeTrackingEvent({
      rawStatus: simRawStatus,
      rawLocation: simRawLoc,
      rawDescription: simRawDesc,
    }),
  );

  const runSimulation = (status: string, loc: string, desc: string): void => {
    setSimRawStatus(status);
    setSimRawLoc(loc);
    setSimRawDesc(desc);
    setSimulatedResult(
      sanitizeTrackingEvent({
        rawStatus: status,
        rawLocation: loc,
        rawDescription: desc,
      }),
    );
  };

  const PRESET_TEST_CASES = [
    {
      title: 'Delhi Export Hub',
      status: 'Customs release at origin facility',
      loc: 'Delhi Air Cargo Hub, India',
      desc: 'Package passed outward customs inspection and is waiting for flight departure',
    },
    {
      title: 'Tirupur Garment Hub',
      status: 'Carrier picked up package from manufacturing hub',
      loc: 'Tirupur, Tamil Nadu',
      desc: 'Initial pickup scan completed by international freight linehaul',
    },
    {
      title: 'US Port of Entry',
      status: 'Import clearance and port scan',
      loc: 'JFK International Airport Cargo',
      desc: 'Customs broker cleared container for domestic postal transfer',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              Stealth Logistics Command Center
            </h2>
            <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Origin Masking Active
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            End-to-end international tracking sanitization, carrier hub routing, and domestic proxy
            monitoring.
          </p>
        </div>
      </div>

      {/* Logistics Overview Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="shadow-xs rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Active Shipments
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-zinc-900">
            {stats.totalInTransit}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Orders currently in transit</div>
        </div>

        <div className="shadow-xs rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Origin Masking Success
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-600">100%</div>
          <div className="mt-1 text-xs text-emerald-700">0 foreign leak incidents</div>
        </div>

        <div className="shadow-xs rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Average Delivery Speed
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-zinc-900">6.4 Days</div>
          <div className="mt-1 text-xs text-zinc-400">Within standard 5-8 day SLA</div>
        </div>

        <div className="shadow-xs rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Domestic Final Mile
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-indigo-600">USPS / FedEx</div>
          <div className="mt-1 text-xs text-zinc-400">Standard domestic handoff</div>
        </div>
      </div>

      {/* Interactive Stealth Sanitizer Simulator */}
      <div className="shadow-xs space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900">
              <Shield className="h-5 w-5 text-emerald-600" />
              Interactive Stealth Sanitizer Simulator
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Test how raw international freight carrier updates are scrubbed into customer-facing
              US milestones.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-500">Preset Scenarios:</span>
            {PRESET_TEST_CASES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => runSimulation(preset.status, preset.loc, preset.desc)}
                className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Simulator Input Form */}
          <div className="space-y-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
              1. Raw Carrier Telemetry (Input)
            </span>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                Raw Event Status
              </label>
              <input
                type="text"
                value={simRawStatus}
                onChange={(e) => runSimulation(e.target.value, simRawLoc, simRawDesc)}
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                Raw Origin / Transit Location
              </label>
              <input
                type="text"
                value={simRawLoc}
                onChange={(e) => runSimulation(simRawStatus, e.target.value, simRawDesc)}
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs text-rose-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                Raw Carrier Description Notes
              </label>
              <textarea
                rows={3}
                value={simRawDesc}
                onChange={(e) => runSimulation(simRawStatus, simRawLoc, e.target.value)}
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs focus:bg-white"
              />
            </div>
          </div>

          {/* Sanitized Live Output Preview */}
          <div className="space-y-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-emerald-800">
              2. Sanitized Customer-Facing Output (Stealth Output)
            </span>

            <StealthPreviewCard
              event={simulatedResult}
              className="border-emerald-200 bg-emerald-50/20"
            />

            <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              <div className="font-semibold text-zinc-900">Applied Sanitization Rules:</div>
              <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-500">
                <li>Geographic entity stripped and remapped to standard Carrier Regional Hub.</li>
                <li>Customs / freight jargon translated to standard processing language.</li>
                <li>Conceals cross-border freight routes from end consumer tracking portal.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Active Shipments Queue */}
      <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Truck className="h-4 w-4 text-zinc-500" />
              Active Shipments Pipeline ({initialActiveShipments.length})
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Live orders currently in transit or awaiting carrier dispatch
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-semibold text-zinc-700 hover:text-zinc-900"
          >
            Manage all orders →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Tracking Code</th>
                <th className="px-4 py-3">Carrier</th>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {initialActiveShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    No shipments currently in transit queue.
                  </td>
                </tr>
              ) : (
                initialActiveShipments.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-900">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-zinc-900">{order.customerName}</div>
                      <div className="font-mono text-[11px] text-zinc-400">
                        {order.customerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-600">
                      {order.tracking_code || 'Pending Dispatch'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-zinc-700">
                      {order.carrier || 'Standard Logistics'}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.status} type="order" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-semibold text-zinc-900 hover:underline"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Tracking Telemetry Log */}
      <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Recent Carrier Telemetry Events ({initialRecentEvents.length})
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Live audit stream of all tracking events processed by the stealth sanitization engine
            </p>
          </div>
        </div>

        {initialRecentEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No carrier tracking events logged recently.
          </div>
        ) : (
          <div className="space-y-3">
            {initialRecentEvents.slice(0, 10).map((evt) => (
              <div
                key={evt.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-zinc-900">
                    {evt.customer_facing_status || evt.status}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    📍 {evt.location || 'Carrier Regional Hub'}{' '}
                    {evt.description && `— ${evt.description}`}
                  </div>
                  {evt.raw_status && (
                    <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                      Raw source: &quot;{evt.raw_status}&quot;
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-right font-mono text-[11px] text-zinc-400">
                  {new Date(evt.event_timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
