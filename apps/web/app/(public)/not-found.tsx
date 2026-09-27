import { ArrowRight, Compass, Home, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="font-mono text-sm font-semibold uppercase tracking-widest text-neutral-400">
        Error 404
      </span>

      <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
        Page Not Found
      </h1>

      <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-600 sm:text-base">
        The piece or page you are looking for doesn’t exist, has been moved, or is temporarily out
        of rotation.
      </p>

      {/* Primary Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/shop"
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800"
        >
          <ShoppingBag className="h-4 w-4" />
          Shop All
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
        >
          <Home className="h-4 w-4" />
          Return Home
        </Link>
      </div>

      {/* Suggested Categories */}
      <div className="mt-14 w-full border-t border-neutral-200 pt-8">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          <Compass className="h-4 w-4" />
          <span>Popular Categories</span>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:gap-4">
          <Link
            href="/category/men"
            className="group inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Men&apos;s Collection
            <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <Link
            href="/category/women"
            className="group inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Women&apos;s Collection
            <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
          <Link
            href="/category/accessories"
            className="group inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Accessories
            <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}
