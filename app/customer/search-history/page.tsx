import { Metadata } from 'next';
import { CustomerSearchHistoryClient } from '@/components/customer-search-history-client';

export const metadata: Metadata = {
  title: 'Search History | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerSearchHistoryPage() {
  return <CustomerSearchHistoryClient />;
}
