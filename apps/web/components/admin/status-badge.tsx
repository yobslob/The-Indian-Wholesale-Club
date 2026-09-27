import React from 'react';

import type { OrderStatusEnum, PaymentStatusEnum } from '@repo/shared/types';

interface StatusBadgeProps {
  status: OrderStatusEnum | PaymentStatusEnum | string;
  type?: 'order' | 'payment';
  className?: string;
}

export function StatusBadge({
  status,
  type = 'order',
  className = '',
}: StatusBadgeProps): React.JSX.Element {
  let label = status;
  let bgClass = 'bg-zinc-100 text-zinc-800 border-zinc-200';
  let dotClass = 'bg-zinc-400';

  if (type === 'payment') {
    switch (status) {
      case 'paid':
        label = 'Paid';
        bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        dotClass = 'bg-emerald-500';
        break;
      case 'pending':
        label = 'Payment Pending';
        bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
        dotClass = 'bg-amber-500';
        break;
      case 'failed':
        label = 'Failed';
        bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
        dotClass = 'bg-rose-500';
        break;
      case 'refunded':
        label = 'Refunded';
        bgClass = 'bg-purple-50 text-purple-700 border-purple-200';
        dotClass = 'bg-purple-500';
        break;
    }
  } else {
    switch (status) {
      case 'confirmed':
        label = 'Confirmed';
        bgClass = 'bg-blue-50 text-blue-700 border-blue-200';
        dotClass = 'bg-blue-500';
        break;
      case 'processing':
        label = 'Processing';
        bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
        dotClass = 'bg-amber-500 animate-pulse';
        break;
      case 'shipped':
      case 'in_transit':
        label = 'In Transit';
        bgClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        dotClass = 'bg-indigo-500';
        break;
      case 'out_for_delivery':
        label = 'Out for Delivery';
        bgClass = 'bg-sky-50 text-sky-700 border-sky-200';
        dotClass = 'bg-sky-500';
        break;
      case 'delivered':
        label = 'Delivered';
        bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        dotClass = 'bg-emerald-500';
        break;
      case 'cancelled':
        label = 'Cancelled';
        bgClass = 'bg-zinc-100 text-zinc-600 border-zinc-200';
        dotClass = 'bg-zinc-400';
        break;
      case 'refunded':
        label = 'Refunded';
        bgClass = 'bg-purple-50 text-purple-700 border-purple-200';
        dotClass = 'bg-purple-500';
        break;
      case 'pending':
        label = 'Pending';
        bgClass = 'bg-yellow-50 text-yellow-700 border-yellow-200';
        dotClass = 'bg-yellow-500';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${bgClass} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
