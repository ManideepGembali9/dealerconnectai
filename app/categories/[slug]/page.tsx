import type { Metadata } from 'next';
import { CategoriesClient } from '@/components/categories-client';
import { INITIAL_CATEGORIES } from '@/lib/seed-data';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = INITIAL_CATEGORIES.find((c) => c.slug === params.slug);
  return {
    title: cat ? `${cat.name} — Local Stores & Available Stock` : 'Category Products',
    description: cat?.description || 'Browse local products and find verified neighborhood shops.',
  };
}

export default function CategoryDetailPage({ params }: { params: { slug: string } }) {
  return <CategoriesClient initialCategorySlug={params.slug} />;
}
