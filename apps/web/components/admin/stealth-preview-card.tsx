import React from 'react';

import type { SanitizedTrackingEvent } from '@repo/shared/types';

interface StealthPreviewCardProps {
  event: SanitizedTrackingEvent;
  className?: string;
}

export function StealthPreviewCard({
  event,
  className = '',
}: StealthPreviewCardProps): React.JSX.Element {
  return (
    <div className={`shadow-xs rounded-xl border border-zinc-200 bg-white p-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Stealth Sanitization Active
          </span>
        </div>
        <span className="font-mono text-[11px] text-zinc-400">
          {new Date(event.eventTimestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Raw Carrier Input */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Internal / Carrier Raw Scan
            </span>
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700">
              Raw
            </span>
          </div>
          <div className="text-xs font-medium text-zinc-800">{event.rawStatus}</div>
          {event.rawLocation && (
            <div className="mt-1 font-mono text-xs text-rose-600">📍 {event.rawLocation}</div>
          )}
          {event.rawDescription && (
            <div className="mt-1 text-xs italic text-zinc-500">
              &quot;{event.rawDescription}&quot;
            </div>
          )}
        </div>

        {/* Masked Customer Output */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Customer Facing View
            </span>
            <span className="rounded bg-emerald-200 px-1.5 py-0.5 font-mono text-[10px] text-emerald-900">
              Masked
            </span>
          </div>
          <div className="text-xs font-semibold text-emerald-900">{event.customerFacingStatus}</div>
          <div className="mt-1 font-mono text-xs text-emerald-700">
            📍 {event.customerFacingLocation}
          </div>
          <div className="mt-1 text-xs text-emerald-800">{event.customerFacingDescription}</div>
        </div>
      </div>
    </div>
  );
}
