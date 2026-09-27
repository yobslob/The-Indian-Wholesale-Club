'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { SHIPPING_RATES } from '@repo/shared/constants';

const FAQ_SECTIONS = [
  {
    category: 'Orders & Payments',
    items: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, MasterCard, American Express, Discover), Apple Pay, Google Pay, and PayPal.',
      },
      {
        q: 'Can I change or cancel my order after placing it?',
        a: 'We process orders quickly in small batches. If you need to make changes, please contact us within 1 hour of placing your order.',
      },
      {
        q: 'How do I apply a promo code?',
        a: 'Enter your code in the Promo Code field during checkout or in your Shopping Bag before proceeding to payment.',
      },
    ],
  },
  {
    category: 'Shipping & Delivery',
    items: [
      {
        q: 'How long does domestic US shipping take?',
        a: `Standard Shipping typically arrives in ${SHIPPING_RATES.standard.windowLabel}. Express shipping takes ${SHIPPING_RATES.express.windowLabel}.`,
      },
      {
        q: 'How much does shipping cost?',
        a: `Standard shipping is free on orders over $${SHIPPING_RATES.freeThreshold}. For orders under $${SHIPPING_RATES.freeThreshold}, standard shipping is a flat $${SHIPPING_RATES.standard.price}. Express shipping is $${SHIPPING_RATES.express.price}.`,
      },
      {
        q: 'Where does ROOT ship from?',
        a: 'All orders are shipped from our domestic logistics facility in New Jersey, USA.',
      },
    ],
  },
  {
    category: 'Returns & Exchanges',
    items: [
      {
        q: 'What is your return policy?',
        a: 'We accept returns of unworn, unwashed items in original condition with tags attached within 30 days of delivery.',
      },
      {
        q: 'How do I initiate a return or exchange?',
        a: 'Visit our Shipping & Returns page or contact customer support with your order number to generate a prepaid return label.',
      },
      {
        q: 'When will I receive my refund?',
        a: 'Refunds are issued to your original payment method within 3–5 business days of receiving and inspecting your returned items.',
      },
    ],
  },
];

export default function FAQPage(): React.JSX.Element {
  const [openItem, setOpenItem] = useState<string | null>('Orders & Payments-0');

  const toggleItem = (id: string) => {
    setOpenItem((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mx-auto max-w-screen-md px-4 py-12 md:px-8 md:py-20">
      <div className="text-center">
        <h1 className="font-display text-primary text-4xl font-bold tracking-tight md:text-5xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-4 text-base text-neutral-600">
          Everything you need to know about our products, shipping, and returns.
        </p>
      </div>

      <div className="mt-12 space-y-12">
        {FAQ_SECTIONS.map((section) => (
          <div key={section.category}>
            <h2 className="font-display text-primary text-xl font-bold">{section.category}</h2>
            <div className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
              {section.items.map((item, idx) => {
                const itemId = `${section.category}-${idx}`;
                const isOpen = openItem === itemId;
                return (
                  <div key={item.q} className="py-4">
                    <button
                      type="button"
                      onClick={() => toggleItem(itemId)}
                      className="flex w-full items-center justify-between text-left text-sm font-semibold text-neutral-900 hover:text-neutral-700"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="mt-3 text-sm leading-relaxed text-neutral-600">{item.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
