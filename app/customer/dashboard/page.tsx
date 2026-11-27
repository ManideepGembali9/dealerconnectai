import { Metadata } from 'next';
import { CustomerDashboardClient } from '@/components/customer-dashboard-client';

export const metadata: Metadata = {
  title: 'Customer Dashboard | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerDashboardPage() {
  return <CustomerDashboardClient />;
}
