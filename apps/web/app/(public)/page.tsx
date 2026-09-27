import {
  BrandStory,
  FeaturedCategories,
  HeroSection,
  NewsletterSignup,
  TrendingProducts,
} from '@/components/home';
import { getFeaturedProducts, getProductImages } from '@/lib/queries';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structured-data';
import { createClient } from '@/lib/supabase/server';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ROOT — Premium Essentials for the Modern Wardrobe',
  description:
    'Thoughtfully designed, responsibly made. Discover timeless pieces crafted from premium materials.',
  openGraph: {
    title: 'ROOT — Premium Essentials',
    description: 'Timeless pieces for the modern wardrobe.',
    type: 'website',
  },
};

export const revalidate = 3600; // ISR: Revalidate every hour

export default async function HomePage(): Promise<React.JSX.Element> {
  let products: Awaited<ReturnType<typeof getFeaturedProducts>> = [];
  let images: Awaited<ReturnType<typeof getProductImages>> = [];

  try {
    const supabase = await createClient();
    products = await getFeaturedProducts(supabase, 8);
    const productIds = products.map((p) => p.id);
    images = await getProductImages(supabase, productIds);
  } catch {
    // Supabase not connected yet — render with empty data
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />
      <HeroSection />
      <FeaturedCategories />
      {products.length > 0 && <TrendingProducts products={products} images={images} />}
      <BrandStory />
      <NewsletterSignup />
    </>
  );
}
