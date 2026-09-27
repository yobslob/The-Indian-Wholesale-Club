'use client';

import { Loader2, X } from 'lucide-react';
import { useState } from 'react';

import { US_STATES } from '@repo/shared/constants';
import { addressSchema } from '@repo/shared/schemas';

import type { AddressInput } from '@repo/shared/schemas';
import type { Address } from '@repo/shared/types';

interface AddressFormProps {
  initialData?: Address | null;
  onSubmit: (data: AddressInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AddressForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: AddressFormProps): React.JSX.Element {
  const [formData, setFormData] = useState<AddressInput>({
    fullName: initialData?.full_name || '',
    label: initialData?.label || '',
    line1: initialData?.line1 || '',
    line2: initialData?.line2 || '',
    city: initialData?.city || '',
    state: initialData?.state || 'NY',
    zipCode: initialData?.zip_code || '',
    country: 'US',
    phone: initialData?.phone || '',
    isDefault: initialData?.is_default || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = addressSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    await onSubmit(result.data);
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
        <h3 className="font-display text-primary text-lg font-bold">
          {initialData ? 'Edit Address' : 'Add New Address'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Close form"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Full Name */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
          >
            Full Name *
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="John Doe"
            className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
          />
          {errors.fullName && <p className="text-destructive mt-1 text-xs">{errors.fullName}</p>}
        </div>

        {/* Street Address Line 1 */}
        <div>
          <label
            htmlFor="line1"
            className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
          >
            Street Address *
          </label>
          <input
            id="line1"
            name="line1"
            type="text"
            value={formData.line1}
            onChange={handleChange}
            placeholder="123 Main St"
            className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
          />
          {errors.line1 && <p className="text-destructive mt-1 text-xs">{errors.line1}</p>}
        </div>

        {/* Street Address Line 2 */}
        <div>
          <label
            htmlFor="line2"
            className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
          >
            Apt, Suite, Building (Optional)
          </label>
          <input
            id="line2"
            name="line2"
            type="text"
            value={formData.line2 || ''}
            onChange={handleChange}
            placeholder="Apt 4B"
            className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
          />
        </div>

        {/* City, State, Zip Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* City */}
          <div>
            <label
              htmlFor="city"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
            >
              City *
            </label>
            <input
              id="city"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
              placeholder="New York"
              className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
            />
            {errors.city && <p className="text-destructive mt-1 text-xs">{errors.city}</p>}
          </div>

          {/* State */}
          <div>
            <label
              htmlFor="state"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
            >
              State *
            </label>
            <select
              id="state"
              name="state"
              value={formData.state}
              onChange={handleChange}
              className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
            >
              {US_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
            {errors.state && <p className="text-destructive mt-1 text-xs">{errors.state}</p>}
          </div>

          {/* ZIP Code */}
          <div>
            <label
              htmlFor="zipCode"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
            >
              ZIP Code *
            </label>
            <input
              id="zipCode"
              name="zipCode"
              type="text"
              value={formData.zipCode}
              onChange={handleChange}
              placeholder="10001"
              maxLength={10}
              className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
            />
            {errors.zipCode && <p className="text-destructive mt-1 text-xs">{errors.zipCode}</p>}
          </div>
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
          >
            Phone Number (for delivery updates)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone || ''}
            onChange={handleChange}
            placeholder="(555) 000-0000"
            className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
          />
        </div>

        {/* Default Checkbox */}
        <div className="pt-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="isDefault"
              checked={formData.isDefault}
              onChange={handleChange}
              className="text-primary focus:ring-primary h-4 w-4 rounded border-neutral-300"
            />
            <span className="text-xs text-neutral-700">Set as my default shipping address</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50"
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initialData ? 'Save Changes' : 'Add Address'}
          </button>
        </div>
      </form>
    </div>
  );
}
