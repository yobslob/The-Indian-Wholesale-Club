'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

import { SHIPPING_RATES } from '@repo/shared/constants';
import { formatUSD } from '@repo/shared/utils';

import type { Product } from '@repo/shared/types';

interface ProductTabsProps {
  product: Product;
}

export function ProductTabs({ product }: ProductTabsProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'details' | 'shipping' | 'reviews'>('details');

  return (
    <div className="mt-16 border-t border-neutral-200 pt-10">
      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`pb-4 text-sm font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'details'
              ? 'border-primary text-primary border-b-2'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Details & Sizing
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shipping')}
          className={`ml-8 pb-4 text-sm font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'shipping'
              ? 'border-primary text-primary border-b-2'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Shipping & Returns
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`ml-8 pb-4 text-sm font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'reviews'
              ? 'border-primary text-primary border-b-2'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          Reviews (128)
        </button>
      </div>

      {/* Tab Content */}
      <div className="py-6 text-sm leading-relaxed text-neutral-600">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <p>{product.long_description || product.description}</p>
            {product.tags && product.tags.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
                  Tags:{' '}
                </span>
                <span className="text-xs text-neutral-500">{product.tags.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'shipping' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-neutral-900">US Domestic Shipping</h4>
            <p>
              {SHIPPING_RATES.standard.label}: {formatUSD(SHIPPING_RATES.standard.price)} (Free on
              orders over ${SHIPPING_RATES.freeThreshold}).
            </p>
            <p>
              {SHIPPING_RATES.express.label}: {formatUSD(SHIPPING_RATES.express.price)}.
            </p>
            <h4 className="pt-2 font-semibold text-neutral-900">Returns & Exchanges</h4>
            <p>
              We gladly accept returns of unworn, unwashed items in original condition with tags
              attached within 30 days of delivery.
            </p>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="font-display text-primary text-4xl font-bold">4.9</p>
                <div className="mt-1 flex text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-1 text-xs text-neutral-500">Based on 128 reviews</p>
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-4">
              <p className="font-medium text-neutral-900">“Exceptional quality and cut”</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
                <span className="text-xs font-medium text-neutral-800">Verified Buyer</span>
              </div>
              <p className="mt-2 text-xs text-neutral-600">
                The drape and feel of the fabric is incredible. Easily my favorite piece this
                season.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
