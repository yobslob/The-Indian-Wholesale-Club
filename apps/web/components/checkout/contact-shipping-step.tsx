'use client';

import Link from 'next/link';
import { useState } from 'react';

import { US_STATES } from '@repo/shared/constants';
import { checkoutShippingSchema } from '@repo/shared/schemas';

import type { CheckoutShippingInput } from '@repo/shared/schemas';

interface ContactShippingStepProps {
  initialValues: CheckoutShippingInput;
  onSubmit: (data: CheckoutShippingInput) => void;
  isAuthenticated?: boolean;
}

export function ContactShippingStep({
  initialValues,
  onSubmit,
  isAuthenticated = false,
}: ContactShippingStepProps): React.JSX.Element {
  const [formData, setFormData] = useState<CheckoutShippingInput>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = checkoutShippingSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Contact Section */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Contact Information</h2>
          {!isAuthenticated && (
            <p className="text-xs text-neutral-500">
              Already have an account?{' '}
              <Link
                href="/login?redirect=/checkout"
                className="text-primary font-medium underline underline-offset-2"
              >
                Log in
              </Link>
            </p>
          )}
        </div>

        <div className="mt-4">
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
          >
            Email Address *
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={`focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${
              errors.email ? 'border-destructive bg-red-50/20' : 'border-neutral-300'
            }`}
          />
          {errors.email && <p className="text-destructive mt-1 text-xs">{errors.email}</p>}
        </div>
      </div>

      {/* Shipping Address Section */}
      <div>
        <h2 className="text-base font-semibold text-neutral-900">
          Shipping Address (United States)
        </h2>

        <div className="mt-4 space-y-4">
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
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="First and last name"
              className={`focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${
                errors.fullName ? 'border-destructive bg-red-50/20' : 'border-neutral-300'
              }`}
            />
            {errors.fullName && <p className="text-destructive mt-1 text-xs">{errors.fullName}</p>}
          </div>

          {/* Street Address */}
          <div>
            <label
              htmlFor="line1"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
            >
              Street Address *
            </label>
            <input
              id="line1"
              type="text"
              name="line1"
              value={formData.line1}
              onChange={handleChange}
              placeholder="123 Main Street"
              className={`focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${
                errors.line1 ? 'border-destructive bg-red-50/20' : 'border-neutral-300'
              }`}
            />
            {errors.line1 && <p className="text-destructive mt-1 text-xs">{errors.line1}</p>}
          </div>

          {/* Apt, suite, unit */}
          <div>
            <label
              htmlFor="line2"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
            >
              Apartment, Suite, Unit (Optional)
            </label>
            <input
              id="line2"
              type="text"
              name="line2"
              value={formData.line2 || ''}
              onChange={handleChange}
              placeholder="Apt 4B"
              className="focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border border-neutral-300 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1"
            />
          </div>

          {/* City, State, ZIP in responsive row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label
                htmlFor="city"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
              >
                City *
              </label>
              <input
                id="city"
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
                className={`focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${
                  errors.city ? 'border-destructive bg-red-50/20' : 'border-neutral-300'
                }`}
              />
              {errors.city && <p className="text-destructive mt-1 text-xs">{errors.city}</p>}
            </div>

            <div className="sm:col-span-2">
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
                className={`focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border bg-white px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${
                  errors.state ? 'border-destructive bg-red-50/20' : 'border-neutral-300'
                }`}
              >
                <option value="">Select</option>
                {US_STATES.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
              {errors.state && <p className="text-destructive mt-1 text-xs">{errors.state}</p>}
            </div>

            <div className="sm:col-span-1">
              <label
                htmlFor="zipCode"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
              >
                ZIP *
              </label>
              <input
                id="zipCode"
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="10001"
                maxLength={10}
                className={`focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 ${
                  errors.zipCode ? 'border-destructive bg-red-50/20' : 'border-neutral-300'
                }`}
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
              Phone Number (For Delivery Updates)
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              placeholder="(555) 000-0000"
              className="focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border border-neutral-300 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
        <Link
          href="/cart"
          className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
        >
          ← Return to Bag
        </Link>

        <button
          type="submit"
          className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center rounded-md px-8 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800"
        >
          Continue to Shipping
        </button>
      </div>
    </form>
  );
}
