import { Metadata } from 'next';
import { CustomerSettingsClient } from '@/components/customer-settings-client';

export const metadata: Metadata = {
  title: 'Settings | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerSettingsPage() {
  return <CustomerSettingsClient />;
}
