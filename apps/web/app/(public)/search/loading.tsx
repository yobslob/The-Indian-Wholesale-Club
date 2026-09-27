import { ProductGridSkeleton, Skeleton } from '@/components/ui';

export default function SearchLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      {/* Header skeleton */}
      <div className="border-b border-neutral-200 pb-6">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="mt-8">
        <div className="mb-6 flex justify-end">
          <Skeleton className="h-10 w-44" />
        </div>
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
