import Link from 'next/link';

const categories = [
  {
    name: 'Men',
    slug: 'men',
    description: 'Shirts, pants & essentials',
    color: 'bg-neutral-900',
    textColor: 'text-white',
  },
  {
    name: 'Women',
    slug: 'women',
    description: 'Dresses, tops & more',
    color: 'bg-neutral-100',
    textColor: 'text-neutral-900',
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Bags, belts & extras',
    color: 'bg-accent',
    textColor: 'text-white',
  },
];

export function FeaturedCategories(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-screen-2xl px-4 py-12 md:px-8 md:py-16 lg:px-12 lg:py-24">
      <div className="mb-8 md:mb-12">
        <h2 className="font-display text-primary text-2xl font-bold tracking-tight md:text-3xl">
          Shop by Category
        </h2>
        <p className="mt-2 text-sm text-neutral-600 md:text-base">
          Find exactly what you&apos;re looking for.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/category/${category.slug}`}
            className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg p-6 transition-transform duration-300 hover:scale-[1.02]"
          >
            {/* Background */}
            <div className={`absolute inset-0 ${category.color}`} />

            {/* Content */}
            <div className="relative z-10">
              <h3 className={`font-display text-2xl font-bold ${category.textColor}`}>
                {category.name}
              </h3>
              <p className={`mt-1 text-sm opacity-80 ${category.textColor}`}>
                {category.description}
              </p>
              <span
                className={`mt-3 inline-block text-xs font-medium uppercase tracking-wider ${category.textColor} opacity-70 transition-opacity group-hover:opacity-100`}
              >
                Browse →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
