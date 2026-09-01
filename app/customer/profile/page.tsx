import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CustomerSettingsClient } from '@/components/customer-settings-client';

export const metadata: Metadata = {
  title: 'Customer Profile | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerProfilePage() {
  redirect('/customer/settings');
}
