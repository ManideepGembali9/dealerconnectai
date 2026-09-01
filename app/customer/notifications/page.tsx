import { Metadata } from 'next';
import { CustomerNotificationsClient } from '@/components/customer-notifications-client';

export const metadata: Metadata = {
  title: 'Notifications | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerNotificationsPage() {
  return <CustomerNotificationsClient />;
}
