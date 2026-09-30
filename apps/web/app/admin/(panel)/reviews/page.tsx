import Image from 'next/image';
import Link from 'next/link';

import { listReviewsForModeration } from '@repo/db/admin';

import { moderateReviewAction } from '@/features/admin/actions/reviews';
import { requireAdminPage } from '@/features/admin/guard';
import { button, PageTitle } from '@/features/admin/ui';
import { reviewPhotoUrl } from '@/lib/site';

/**
 * Reviews waiting for a decision (D-052, D-056): nothing a customer writes appears before an admin approves it.
 * "Verified buyer" was decided by the database from delivered orders; only verified reviews can carry photos.
 */
export default async function ReviewsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const pending = await listReviewsForModeration(client, 'pending');

  return (
    <div className="space-y-6">
      <PageTitle>Reviews</PageTitle>
      <p className="text-ink-muted">
        {pending.length === 0 ? 'Nothing waiting.' : `${pending.length} waiting, oldest first.`} Approved reviews show on the
        product page within a few minutes.
      </p>
      <ul className="grid max-w-3xl gap-4">
        {pending.map((r) => (
          <li key={r.id} className="border-line space-y-2 rounded-md border p-3">
            <p className="text-sm">
              {r.product ? (
                <Link href={`/states/${r.product.region?.slug}/${r.product.slug}`} className="font-medium underline">
                  {r.product.name}
                </Link>
              ) : (
                'Product removed'
              )}{' '}
              · {'★'.repeat(r.rating)}
              {'☆'.repeat(5 - r.rating)} · {r.display_name}
              {r.is_verified_buyer ? ' · verified buyer' : ''} · {new Date(r.created_at).toISOString().slice(0, 10)}
            </p>
            <p className="whitespace-pre-line">{r.body}</p>
            {r.photos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {r.photos
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((p) => (
                    <a key={p.id} href={reviewPhotoUrl(p.storage_path)} target="_blank" rel="noreferrer" className="bg-surface relative block size-24 overflow-hidden rounded-md">
                      <Image src={reviewPhotoUrl(p.storage_path)} alt="Customer photo" fill sizes="96px" className="object-cover" />
                    </a>
                  ))}
              </div>
            ) : null}
            <div className="flex gap-3">
              <form action={moderateReviewAction.bind(null, r.id, 'approved')}>
                <button type="submit" className={button}>
                  Approve
                </button>
              </form>
              <form action={moderateReviewAction.bind(null, r.id, 'rejected')}>
                <button type="submit" className="min-h-11 underline">
                  Reject
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
