import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us — ROOT',
  description:
    'Learn about ROOT: our philosophy of timeless design, ethical manufacturing, and uncompromising quality.',
};

export default function AboutPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-12 md:px-8 md:py-20 lg:px-12">
      {/* Hero Header */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Our Philosophy
        </p>
        <h1 className="font-display text-primary mt-4 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Crafted for Life, Not Trends.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-neutral-600 md:text-lg">
          At ROOT, we believe true luxury lies in restraint. We create wardrobe essentials
          engineered with impeccable materials, architectural silhouettes, and transparent
          craftsmanship.
        </p>
      </div>

      {/* Story Sections */}
      <div className="mt-16 space-y-16 md:mt-24 md:space-y-24">
        {/* Section 1 */}
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-neutral-100 text-sm text-neutral-400">
            Design Studio & Prototyping
          </div>
          <div>
            <h2 className="font-display text-primary text-2xl font-bold md:text-3xl">
              Small-Batch Manufacturing
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600 md:text-base">
              Mass production leads to excessive waste and compromised quality. Instead, we produce
              each garment in limited quantities. Every seam is inspected, every stitch is measured,
              and our waste footprint is reduced by over 60% compared to traditional retail.
            </p>
          </div>
        </div>

        {/* Section 2 */}
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          <div className="order-2 md:order-1">
            <h2 className="font-display text-primary text-2xl font-bold md:text-3xl">
              Uncompromising Materials
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600 md:text-base">
              We travel directly to mills to source organic Supima cotton, Japanese selvage denim,
              and ultra-fine merino wool. Our garments are preshrunk and tested through 50+ wash
              cycles to ensure they keep their structure and softness year after year.
            </p>
          </div>
          <div className="order-1 flex aspect-[4/3] items-center justify-center rounded-lg bg-neutral-100 text-sm text-neutral-400 md:order-2">
            Textile & Fabric Testing
          </div>
        </div>
      </div>

      {/* Values Grid */}
      <div className="mt-20 border-t border-neutral-200 pt-16">
        <h2 className="font-display text-primary text-center text-2xl font-bold md:text-3xl">
          The ROOT Commitments
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
            <p className="font-display text-primary text-3xl font-bold">100%</p>
            <h3 className="mt-2 font-semibold text-neutral-900">Traceable Fibers</h3>
            <p className="mt-2 text-xs text-neutral-600">
              Direct-from-mill raw materials with transparent sourcing records.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
            <p className="font-display text-primary text-3xl font-bold">Fair</p>
            <h3 className="mt-2 font-semibold text-neutral-900">Living Wages</h3>
            <p className="mt-2 text-xs text-neutral-600">
              Ethical factory partnerships with strict labor and safety standards.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
            <p className="font-display text-primary text-3xl font-bold">Zero</p>
            <h3 className="mt-2 font-semibold text-neutral-900">Plastic Packaging</h3>
            <p className="mt-2 text-xs text-neutral-600">
              All orders ship in 100% compostable, recycled paper mailers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
