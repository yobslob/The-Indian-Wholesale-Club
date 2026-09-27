import Link from 'next/link';

export function AnnouncementBar(): React.JSX.Element {
  return (
    <div className="bg-primary text-primary-foreground relative px-4 py-2.5 text-center text-xs font-medium tracking-wide sm:text-sm">
      <p>
        Free shipping on orders over <span className="font-semibold">$75</span>
        <span className="mx-2 hidden sm:inline">·</span>
        <br className="sm:hidden" />
        <Link
          href="/shop"
          className="underline underline-offset-2 transition-opacity hover:opacity-80"
        >
          Shop Now
        </Link>
      </p>
    </div>
  );
}
