import Link from 'next/link';

/** Plain 404. Also what non-admins get for anything under /admin (D-006). */
export default function NotFound(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-24 text-center">
      <h1 className="text-ink text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">This page doesn&apos;t exist.</p>
      <Link href="/" className="underline">
        Back to the homepage
      </Link>
    </main>
  );
}
