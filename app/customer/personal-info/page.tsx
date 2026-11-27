import type { Metadata } from 'next';
import { CustomerPersonalInfoClient } from '@/components/customer-personal-info-client';

export const metadata: Metadata = {
  title: 'Personal Information | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerPersonalInfoPage() {
  return <CustomerPersonalInfoClient />;
}
