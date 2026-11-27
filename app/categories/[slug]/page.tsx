import type { Metadata } from 'next';
import { CategoriesClient } from '@/components/categories-client';
import { INITIAL_CATEGORIES } from '@/lib/seed-data';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = INITIAL_CATEGORIES.find((c) => c.slug === slug);
  return {
    title: cat ? `${cat.name} — Local Stores & Available Stock` : 'Category Products',
    description: cat?.description || 'Browse local products and find verified neighborhood shops.',
  };
}

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CategoriesClient initialCategorySlug={slug} />;
}
