'use client';

import { CheckCircle, Clock, Mail, MessageSquare, Phone } from 'lucide-react';
import { useState } from 'react';

import { SUPPORT_EMAIL } from '@repo/shared/constants';

export default function ContactPage(): React.JSX.Element {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'order_inquiry',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit inquiry');
      }

      setIsSubmitted(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="mx-auto max-w-screen-xl px-4 py-12 md:px-8 md:py-20 lg:px-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-primary text-4xl font-bold tracking-tight md:text-5xl">
          Contact Us
        </h1>
        <p className="mt-4 text-base text-neutral-600">
          Our team is here to assist with sizing advice, order inquiries, or shipping questions.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Contact Information & Channels (4 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-6">
            <h2 className="font-display text-primary text-lg font-bold">Client Concierge</h2>
            <div className="mt-6 space-y-4 text-sm text-neutral-600">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800" />
                <div>
                  <p className="font-semibold text-neutral-900">Email Us</p>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-primary underline hover:text-neutral-700"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                  <p className="mt-0.5 text-xs text-neutral-500">Response within 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800" />
                <div>
                  <p className="font-semibold text-neutral-900">Hours of Operation</p>
                  <p>Monday – Friday: 9:00 AM – 6:00 PM EST</p>
                  <p>Saturday – Sunday: 10:00 AM – 4:00 PM EST</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800" />
                <div>
                  <p className="font-semibold text-neutral-900">Toll-Free Phone</p>
                  <p>(800) 555-ROOT</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Message Form (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-4">
              <MessageSquare className="text-primary h-5 w-5" />
              <h2 className="font-display text-primary text-xl font-bold">Send a Message</h2>
            </div>

            {isSubmitted ? (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h3 className="font-display text-primary mt-4 text-lg font-bold">
                  Message Received
                </h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Thank you for reaching out. A client support specialist will respond to{' '}
                  {formData.email} shortly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setFormData({ name: '', email: '', subject: 'order_inquiry', message: '' });
                  }}
                  className="text-primary mt-6 text-xs font-semibold uppercase tracking-wider underline"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <div>
                {errorMsg && (
                  <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    {errorMsg}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">

                <div>
                  <label
                    htmlFor="name"
                    className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
                  >
                    Your Name *
                  </label>
                  <input
                    id="name"
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Alex Morgan"
                    className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
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
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
                  >
                    Inquiry Subject *
                  </label>
                  <select
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="focus-visible:ring-primary mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1"
                  >
                    <option value="order_inquiry">Order Status & Tracking</option>
                    <option value="returns">Returns & Exchanges</option>
                    <option value="sizing">Product Sizing & Fit Advice</option>
                    <option value="press">Press & Collaboration</option>
                    <option value="other">Other Inquiry</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-xs font-semibold uppercase tracking-wider text-neutral-700"
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Please include your order number if applicable..."
                    className="focus-visible:ring-primary mt-1.5 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-1"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary text-primary-foreground w-full rounded-md py-3 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sending Inquiry...' : 'Send Inquiry'}
                  </button>
                </div>
              </form>
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  );
}
