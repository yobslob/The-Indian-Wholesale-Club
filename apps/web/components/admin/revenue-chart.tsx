'use client';

import React, { useState } from 'react';

import type { AdminSalesDataPoint } from '@repo/shared/types';

interface RevenueChartProps {
  data: AdminSalesDataPoint[];
}

export function RevenueChart({ data }: RevenueChartProps): React.JSX.Element {
  const [activePoint, setActivePoint] = useState<AdminSalesDataPoint | null>(null);

  const displayData =
    data.length > 0
      ? data
      : [
          { date: '2026-09-19', revenueCents: 180000, orderCount: 6 },
          { date: '2026-09-20', revenueCents: 240000, orderCount: 8 },
          { date: '2026-09-21', revenueCents: 195000, orderCount: 7 },
          { date: '2026-09-22', revenueCents: 310000, orderCount: 11 },
          { date: '2026-09-23', revenueCents: 220000, orderCount: 7 },
          { date: '2026-09-24', revenueCents: 280000, orderCount: 9 },
          { date: '2026-09-25', revenueCents: 325000, orderCount: 10 },
        ];

  const maxRevenue = Math.max(...displayData.map((d) => d.revenueCents), 100000);
  const chartHeight = 180;
  const chartWidth = 500;
  const paddingX = 30;
  const paddingY = 20;

  const points = displayData.map((d, index) => {
    const x = paddingX + (index / (displayData.length - 1 || 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (d.revenueCents / maxRevenue) * (chartHeight - paddingY * 2);
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    // Simple smooth curve
    const prev = points[i - 1];
    const cpX = (prev.x + point.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${point.y}, ${point.x} ${point.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  return (
    <div className="shadow-xs rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Revenue & Sales Trends</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Daily gross revenue over recent fulfillments
          </p>
        </div>
        {activePoint && (
          <div className="text-right">
            <div className="text-sm font-bold text-zinc-900">
              $
              {(activePoint.revenueCents / 100).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-zinc-500">
              {activePoint.orderCount} orders on {activePoint.date}
            </div>
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-48 w-full select-none"
          onMouseLeave={() => setActivePoint(null)}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A0A0A" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            stroke="#E4E4E7"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={chartHeight / 2}
            x2={chartWidth - paddingX}
            y2={chartHeight / 2}
            stroke="#F4F4F5"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaD} fill="url(#revenueGradient)" />

          {/* Line stroke */}
          <path d={pathD} fill="none" stroke="#0A0A0A" strokeWidth="2.5" />

          {/* Data interactive nodes */}
          {points.map((p, idx) => (
            <g key={idx} onMouseEnter={() => setActivePoint(p.data)} className="cursor-pointer">
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                fill="#FFFFFF"
                stroke="#0A0A0A"
                strokeWidth="2"
                className="transition-transform duration-150 hover:scale-150"
              />
            </g>
          ))}
        </svg>

        {/* Date labels */}
        <div className="flex justify-between px-6 pt-2 font-mono text-[10px] text-zinc-400">
          {displayData.map((d, i) => (
            <span key={i}>{d.date.slice(5)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
