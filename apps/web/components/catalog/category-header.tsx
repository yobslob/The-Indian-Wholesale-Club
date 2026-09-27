import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface CategoryHeaderProps {
  title: string;
  description?: string | null;
  breadcrumbs: BreadcrumbItem[];
  itemCount: number;
}

export function CategoryHeader({
  title,
  description,
  breadcrumbs,
  itemCount,
}: CategoryHeaderProps): React.JSX.Element {
  return (
    <div className="border-b border-neutral-200 pb-8 pt-6">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center space-x-2 text-xs text-neutral-500">
          <li>
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
          </li>
          {breadcrumbs.map((crumb, idx) => (
            <li key={crumb.name} className="flex items-center space-x-2">
              <ChevronRight className="h-3 w-3 text-neutral-400" />
              {crumb.href && idx < breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="hover:text-primary transition-colors">
                  {crumb.name}
                </Link>
              ) : (
                <span className="font-medium text-neutral-900">{crumb.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Title & Count */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-primary text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">{description}</p>
          )}
        </div>
        <p className="text-xs uppercase tracking-wider text-neutral-500">
          {itemCount} {itemCount === 1 ? 'Product' : 'Products'}
        </p>
      </div>
    </div>
  );
}
