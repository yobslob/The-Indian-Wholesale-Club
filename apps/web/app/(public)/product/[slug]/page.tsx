import { notFound } from 'next/navigation';

import { ProductGallery, ProductInfo, ProductTabs, RelatedProducts } from '@/components/product';
import { getProductImages, getProductBySlug, getRelatedProducts } from '@/lib/queries';
import { productJsonLd } from '@/lib/seo/structured-data';
import { createClient } from '@/lib/supabase/server';

import type { Product, ProductImage } from '@repo/shared/types';
import type { Metadata } from 'next';

interface ProductDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const product = await getProductBySlug(supabase, slug);
    if (!product) {
      return { title: 'Product Not Found — ROOT' };
    }
    const primaryImg = product.images.find((i) => i.is_primary)?.url;
    return {
      title: `${product.name} — ROOT`,
      description: product.description || undefined,
      openGraph: {
        title: `${product.name} — ROOT`,
        description: product.description || undefined,
        images: primaryImg ? [{ url: primaryImg }] : [],
      },
    };
  } catch {
    return { title: 'Product Detail — ROOT' };
  }
}

export const revalidate = 3600; // ISR: 1 hour

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps): Promise<React.JSX.Element> {
  const { slug } = await params;

  let productDetails: Awaited<ReturnType<typeof getProductBySlug>> = null;
  let relatedProducts: Product[] = [];
  let relatedImages: ProductImage[] = [];

  try {
    const supabase = await createClient();
    productDetails = await getProductBySlug(supabase, slug);

    if (productDetails) {
      relatedProducts = await getRelatedProducts(
        supabase,
        productDetails.id,
        productDetails.category_id,
        4,
      );
      if (relatedProducts.length > 0) {
        relatedImages = await getProductImages(
          supabase,
          relatedProducts.map((p) => p.id),
        );
      }
    }
  } catch (err) {
    console.error(`[Product Page] Failed to fetch product details for '${slug}':`, err);
    throw err;
  }

  if (!productDetails) {
    notFound();
  }


  const { category, variants, images, ...product } = productDetails;

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            productJsonLd(
              product,
              images.find((i) => i.is_primary)?.url || images[0]?.url,
              variants,
            ),
          ),
        }}
      />
      {/* Main PDP Grid: Gallery on left, Info on right */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <ProductGallery images={images} productName={product.name} />
        </div>
        <div>
          <ProductInfo
            product={product}
            category={category}
            variants={variants}
            primaryImageUrl={images.find((i) => i.is_primary)?.url}
          />
        </div>
      </div>

      {/* Tabs: Details, Shipping, Reviews */}
      <ProductTabs product={product} />

      {/* Related Products Recommendations */}
      <RelatedProducts products={relatedProducts} images={relatedImages} />
    </div>
  );
}
