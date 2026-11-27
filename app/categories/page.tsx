import type { Metadata } from 'next';
import { CategoriesClient } from '@/components/categories-client';

export const metadata: Metadata = {
  title: 'Categories Catalog — Explore Local Showrooms & Inventories',
  description:
    'Browse local product categories: Electronics, Home Appliances, Fashion, Pharmacy, and Hardware from verified local neighborhood dealers.',
};

export default function CategoriesPage() {
  return <CategoriesClient />;
}
