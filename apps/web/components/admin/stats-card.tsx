import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function StatsCard({
  title,
  value,
  change,
  isPositive,
  subtitle,
  icon,
}: StatsCardProps): React.JSX.Element {
  return (
    <div className="shadow-xs flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</span>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="text-2xl font-bold tracking-tight text-zinc-900">{value}</div>

        {(change || subtitle) && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            {change && (
              <span
                className={`flex items-center font-semibold ${
                  isPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isPositive ? '↑ ' : '↓ '}
                {change}
              </span>
            )}
            {subtitle && <span className="text-zinc-500">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
