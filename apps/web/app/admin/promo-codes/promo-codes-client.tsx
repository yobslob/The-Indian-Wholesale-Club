'use client';

import { Check, Loader2, Plus, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import React, { useState } from 'react';

import type { PromoCode } from '@repo/shared/types';

interface PromoCodesClientProps {
  initialPromoCodes: PromoCode[];
}

export function PromoCodesClient({ initialPromoCodes }: PromoCodesClientProps): React.JSX.Element {
  const [promos, setPromos] = useState<PromoCode[]>(initialPromoCodes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // New promo form state
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrder, setMinOrder] = useState('50.00');
  const [maxUses, setMaxUses] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggle = async (id: string, currentActive: boolean): Promise<void> => {
    setTogglingId(id);
    setToggleError(null);
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });

      if (res.ok) {
        setPromos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_active: !currentActive } : p)),
        );
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setToggleError(body?.error ?? 'Failed to update promo code');
      }
    } catch (err) {
      console.error('[Toggle Promo] error:', err);
      setToggleError('Network error updating promo code');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const parsedValue =
        discountType === 'percentage'
          ? parseInt(discountValue, 10)
          : Math.round(parseFloat(discountValue) * 100);

      const parsedMinOrderCents = minOrder ? Math.round(parseFloat(minOrder) * 100) : 0;
      const parsedMaxUses = maxUses ? parseInt(maxUses, 10) : null;

      const payload = {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: parsedValue,
        minOrderCents: parsedMinOrderCents,
        maxUses: parsedMaxUses,
        isActive: true,
      };

      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Refetch promos
        const listRes = await fetch('/api/admin/promo-codes');
        if (listRes.ok) {
          const updated = await listRes.json();
          setPromos(updated);
        }
        setIsModalOpen(false);
        setCode('');
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to create promo code');
      }
    } catch {
      setErrorMsg('Network error creating promo code');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Promotions & Discounts
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Create and track promotional discount vouchers and coupon redemption.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="shadow-xs inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          Create Promo Code
        </button>
      </div>

      {toggleError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          {toggleError}
        </div>
      )}

      {/* Promo Codes Table */}
      <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Coupon Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min. Spend</th>
                <th className="px-4 py-3">Redemptions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Toggle Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {promos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <Tag className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    No promotional codes created yet.
                  </td>
                </tr>
              ) : (
                promos.map((promo) => (
                  <tr key={promo.id} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1 font-mono font-bold text-zinc-900">
                        <Tag className="h-3 w-3 text-zinc-500" />
                        {promo.code}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-zinc-900">
                      {promo.discount_type === 'percentage'
                        ? `${promo.discount_value}% OFF`
                        : `$${(promo.discount_value / 100).toFixed(2)} OFF`}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-600">
                      {promo.min_order_cents && promo.min_order_cents > 0
                        ? `$${(promo.min_order_cents / 100).toFixed(2)}`
                        : 'No minimum'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-700">
                      <span className="font-bold text-zinc-900">{promo.current_uses}</span>
                      {promo.max_uses ? ` / ${promo.max_uses}` : ' / ∞'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          promo.is_active
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-zinc-200 bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {promo.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggle(promo.id, promo.is_active)}
                        disabled={togglingId === promo.id}
                        className="p-1 text-zinc-600 transition-colors hover:text-zinc-900"
                      >
                        {promo.is_active ? (
                          <ToggleRight className="h-6 w-6 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-zinc-400" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Promo Modal */}
      {isModalOpen && (
        <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900">Create New Promo Voucher</h3>

            {errorMsg && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                  Promo Code *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FLASH20"
                  className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs font-bold uppercase focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                    Value *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                    Min. Order ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    placeholder="50.00"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                    Max Redemptions
                  </label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Unlimited"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Save Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
