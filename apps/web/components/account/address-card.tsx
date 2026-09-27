'use client';

import { Check, Edit2, MapPin, Trash2 } from 'lucide-react';

import type { Address } from '@repo/shared/types';

interface AddressCardProps {
  address: Address;
  onEdit: (address: Address) => void;
  onDelete: (addressId: string) => void;
  onSetDefault: (addressId: string) => void;
  isProcessing?: boolean;
}

export function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  isProcessing = false,
}: AddressCardProps): React.JSX.Element {
  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all ${
        address.is_default
          ? 'border-primary ring-primary bg-neutral-50/50 shadow-sm ring-1'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      <div>
        {/* Header badges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {address.label || 'Address'}
            </span>
          </div>
          {address.is_default && (
            <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              <Check className="h-3 w-3" /> Default
            </span>
          )}
        </div>

        {/* Address text */}
        <div className="mt-4 space-y-1 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900">{address.full_name}</p>
          <p>{address.line1}</p>
          {address.line2 && <p>{address.line2}</p>}
          <p>
            {address.city}, {address.state} {address.zip_code}
          </p>
          <p className="text-xs text-neutral-500">{address.country}</p>
          {address.phone && <p className="pt-1 text-xs text-neutral-500">Phone: {address.phone}</p>}
        </div>
      </div>

      {/* Card actions footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-4 text-xs">
        <div>
          {!address.is_default && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onSetDefault(address.id)}
              className="hover:text-primary font-medium text-neutral-600 disabled:opacity-50"
            >
              Set as Default
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onEdit(address)}
            className="hover:text-primary flex items-center gap-1 font-medium text-neutral-600 disabled:opacity-50"
            aria-label="Edit address"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onDelete(address.id)}
            className="hover:text-destructive flex items-center gap-1 font-medium text-neutral-400 disabled:opacity-50"
            aria-label="Delete address"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
