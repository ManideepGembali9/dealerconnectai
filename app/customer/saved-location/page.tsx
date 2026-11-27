import type { Metadata } from 'next';
import { CustomerSavedLocationClient } from '@/components/customer-saved-location-client';

export const metadata: Metadata = {
  title: 'Saved Location | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerSavedLocationPage() {
  return <CustomerSavedLocationClient />;
}
