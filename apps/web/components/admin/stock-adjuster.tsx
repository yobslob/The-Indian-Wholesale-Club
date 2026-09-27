'use client';

import { Check, Loader2, Minus, Plus } from 'lucide-react';
import React, { useState } from 'react';

interface StockAdjusterProps {
  variantId: string;
  initialStock: number;
  lowStockThreshold?: number;
  onStockUpdated?: (newStock: number) => void;
}

export function StockAdjuster({
  variantId,
  initialStock,
  lowStockThreshold = 5,
  onStockUpdated,
}: StockAdjusterProps): React.JSX.Element {
  const [stock, setStock] = useState<number>(initialStock);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const saveStock = async (newStock: number): Promise<void> => {
    setIsSaving(true);
    setIsSaved(false);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, inventoryCount: newStock }),
      });

      if (res.ok) {
        setIsSaved(true);
        onStockUpdated?.(newStock);
        setTimeout(() => setIsSaved(false), 2000);
      }
    } catch (err) {
      console.error('[StockAdjuster] error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDecrement = (): void => {
    const nextVal = Math.max(0, stock - 1);
    setStock(nextVal);
    void saveStock(nextVal);
  };

  const handleIncrement = (): void => {
    const nextVal = stock + 1;
    setStock(nextVal);
    void saveStock(nextVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const parsed = parseInt(e.target.value, 10);
    const nextVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setStock(nextVal);
  };

  const handleBlur = (): void => {
    if (stock !== initialStock) {
      void saveStock(stock);
    }
  };

  const isLow = stock <= lowStockThreshold && stock > 0;
  const isOut = stock === 0;

  return (
    <div className="flex items-center gap-2">
      <div className="shadow-2xs flex items-center overflow-hidden rounded-md border border-zinc-200 bg-white">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={isSaving || stock === 0}
          className="p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <input
          type="number"
          min="0"
          value={stock}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={isSaving}
          className="focus:outline-hidden w-14 py-1 text-center text-xs font-semibold text-zinc-900 focus:bg-zinc-50"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={isSaving}
          className="p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
      {isSaved && <Check className="h-3.5 w-3.5 text-emerald-600" />}

      {isOut ? (
        <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">
          Out of Stock
        </span>
      ) : isLow ? (
        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
          Low Stock
        </span>
      ) : null}
    </div>
  );
}
