import { Metadata } from 'next';
import { CustomerFavoritesClient } from '@/components/customer-favorites-client';

export const metadata: Metadata = {
  title: 'Favorites | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerFavoritesPage() {
  return <CustomerFavoritesClient />;
}
