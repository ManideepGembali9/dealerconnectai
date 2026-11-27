import type { Metadata } from 'next';
import { CustomerSavedStoresClient } from '@/components/customer-saved-stores-client';

export const metadata: Metadata = {
  title: 'Saved Stores | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerSavedStoresPage() {
  return <CustomerSavedStoresClient />;
}
