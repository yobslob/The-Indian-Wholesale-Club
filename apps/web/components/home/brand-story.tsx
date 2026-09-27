export function BrandStory(): React.JSX.Element {
  return (
    <section className="bg-neutral-50">
      <div className="mx-auto max-w-screen-2xl px-4 py-12 md:px-8 md:py-16 lg:px-12 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Image placeholder */}
          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-neutral-200 lg:aspect-square">
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Brand Story Image
            </div>
          </div>

          {/* Text content */}
          <div className="max-w-lg">
            <p className="text-accent text-xs font-semibold uppercase tracking-[0.2em]">
              Our Story
            </p>
            <h2 className="font-display text-primary mt-4 text-2xl font-bold leading-tight tracking-tight md:text-3xl lg:text-4xl">
              Built on the belief that less is more.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-neutral-600">
              We started ROOT with a simple idea: create essential pieces that last. No trends, no
              noise — just quality materials, thoughtful construction, and timeless design that
              works for your life.
            </p>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              Every piece is designed in-house and produced in small batches to reduce waste. We
              partner with ethical factories and source premium fabrics that feel as good as they
              look.
            </p>
            <div className="mt-8 flex gap-8">
              <div>
                <p className="font-display text-primary text-3xl font-bold">100%</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
                  Premium Cotton
                </p>
              </div>
              <div>
                <p className="font-display text-primary text-3xl font-bold">Small</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
                  Batch Production
                </p>
              </div>
              <div>
                <p className="font-display text-primary text-3xl font-bold">Ethical</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
                  Manufacturing
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
