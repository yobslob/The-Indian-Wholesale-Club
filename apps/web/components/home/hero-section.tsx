import Link from 'next/link';

export function HeroSection(): React.JSX.Element {
  return (
    <section className="relative flex min-h-[70vh] items-center bg-neutral-100 lg:min-h-[80vh]">
      {/* Background pattern / placeholder for hero image */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200" />

      <div className="relative mx-auto w-full max-w-screen-2xl px-4 py-16 md:px-8 md:py-24 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-accent text-xs font-semibold uppercase tracking-[0.2em]">
            New Season Collection
          </p>
          <h1 className="font-display text-primary mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Premium
            <br />
            Essentials
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-neutral-600 md:text-lg">
            Thoughtfully designed, responsibly made. Timeless pieces for the modern wardrobe.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/shop"
              className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center rounded-md px-8 text-sm font-medium transition-colors hover:bg-neutral-800"
            >
              Shop Now
            </Link>
            <Link
              href="/category/women"
              className="text-primary inline-flex h-12 items-center justify-center rounded-md border border-neutral-300 bg-white px-8 text-sm font-medium transition-colors hover:bg-neutral-50"
            >
              Women&apos;s Collection
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
