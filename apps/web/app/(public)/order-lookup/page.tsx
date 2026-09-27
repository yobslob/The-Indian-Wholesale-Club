'use client';

import { ArrowRight, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { guestOrderLookupSchema } from '@repo/shared/schemas';

export default function OrderLookupPage(): React.JSX.Element {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = guestOrderLookupSchema.safeParse({
      orderNumber: orderNumber.trim(),
      email: email.trim(),
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Please check your inputs');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber.trim())}?email=${encodeURIComponent(email.trim())}`,
      );
      const data = await res.json();

      if (!res.ok || !data.order) {
        setError('No matching order was found with this order number and email.');
        setIsLoading(false);
        return;
      }

      router.push(`/order-status/${encodeURIComponent(data.order.order_number)}`);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-800">
          <Package className="h-7 w-7 stroke-[1.75]" />
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Track Your Order
        </h1>
        <p className="mt-2 text-xs text-neutral-600 sm:text-sm">
          Enter your order confirmation number and the email address used during purchase.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="orderNumber"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
            >
              Order Number *
            </label>
            <input
              id="orderNumber"
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="ORD-YYYYMMDD-XXXX"
              required
              className="focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border border-neutral-300 px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-1"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
            >
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="focus-visible:ring-primary mt-1.5 h-11 w-full rounded-md border border-neutral-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
            />
          </div>

          {error && (
            <div className="text-destructive rounded-md bg-red-50 p-3 text-xs">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-primary text-primary-foreground flex h-11 w-full items-center justify-center gap-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Searching...
              </span>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Find Order
              </>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-neutral-100 pt-6 text-center text-xs text-neutral-500">
          Have an account?{' '}
          <Link
            href="/login?redirect=/account/orders"
            className="text-primary font-medium underline underline-offset-2 hover:text-neutral-700"
          >
            Sign in to view your full order history <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
