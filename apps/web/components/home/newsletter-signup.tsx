'use client';

import { ArrowRight, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export function NewsletterSignup(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!email) return;
    setError(null);

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'Subscription failed. Please try again.');
        return;
      }

      setIsSubmitted(true);
      setEmail('');
    } catch {
      setError('Subscription failed. Please check your connection.');
    }
  };


  return (
    <section className="bg-primary">
      <div className="mx-auto max-w-screen-2xl px-4 py-12 md:px-8 md:py-16 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
            Join the Community
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300 md:text-base">
            Be the first to know about new drops, exclusive offers, and behind-the-scenes stories.
          </p>

          {isSubmitted ? (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-white">
              <CheckCircle className="h-5 w-5 text-green-400" />
              You&apos;re in! Check your inbox for a welcome surprise.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="h-12 flex-1 rounded-md border border-neutral-600 bg-neutral-800 px-4 text-sm text-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                aria-label="Email address for newsletter"
              />
              <button
                type="submit"
                className="text-primary inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-medium transition-colors hover:bg-neutral-100"
              >
                Subscribe
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          <p className="mt-4 text-xs text-neutral-400">
            No spam, ever. Unsubscribe with a single click.
          </p>
          {error && !isSubmitted && (
            <p className="mt-2 text-xs font-medium text-red-300">{error}</p>
          )}
        </div>
      </div>
    </section>
  );
}
