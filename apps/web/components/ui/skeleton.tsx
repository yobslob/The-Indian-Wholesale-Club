import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-neutral-200/80', className)} {...props} />;
}

export function ProductCardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[3/4] w-full rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductDetailSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Main PDP Grid */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Gallery skeleton */}
        <div className="space-y-4">
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="aspect-[3/4] rounded-md" />
            <Skeleton className="aspect-[3/4] rounded-md" />
            <Skeleton className="aspect-[3/4] rounded-md" />
            <Skeleton className="aspect-[3/4] rounded-md" />
          </div>
        </div>

        {/* Info skeleton */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-20 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-14 rounded-md" />
              <Skeleton className="h-10 w-14 rounded-md" />
              <Skeleton className="h-10 w-14 rounded-md" />
              <Skeleton className="h-10 w-14 rounded-md" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-12 w-28 rounded-md" />
            <Skeleton className="h-12 flex-1 rounded-md" />
            <Skeleton className="h-12 w-12 rounded-md" />
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function CategoryPageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      {/* Header skeleton */}
      <div className="border-b border-neutral-200 pb-6">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Sidebar skeleton */}
        <div className="hidden w-64 space-y-6 lg:block">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Products Column */}
        <div className="flex-1">
          <div className="mb-6 flex justify-end">
            <Skeleton className="h-10 w-44" />
          </div>
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}

export function CartSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      <Skeleton className="mb-8 h-9 w-48" />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 border-b border-neutral-200 pb-6">
              <Skeleton className="h-28 w-24 rounded-md" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function HomeSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero skeleton */}
      <Skeleton className="h-[70vh] w-full rounded-none" />
      {/* Featured categories skeleton */}
      <div className="mx-auto max-w-screen-2xl px-4 md:px-8 lg:px-12">
        <Skeleton className="mb-6 h-8 w-60" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Skeleton className="aspect-square rounded-md" />
          <Skeleton className="aspect-square rounded-md" />
          <Skeleton className="aspect-square rounded-md" />
          <Skeleton className="aspect-square rounded-md" />
        </div>
      </div>
      {/* Trending products skeleton */}
      <div className="mx-auto max-w-screen-2xl px-4 md:px-8 lg:px-12">
        <Skeleton className="mb-6 h-8 w-60" />
        <ProductGridSkeleton count={4} />
      </div>
    </div>
  );
}
