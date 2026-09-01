import { Metadata } from 'next';
import { CustomerEnquiriesClient } from '@/components/customer-enquiries-client';

export const metadata: Metadata = {
  title: 'Enquiries | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerEnquiriesPage() {
  return <CustomerEnquiriesClient />;
}
