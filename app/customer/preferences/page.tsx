import type { Metadata } from 'next';
import { CustomerPreferencesClient } from '@/components/customer-preferences-client';

export const metadata: Metadata = {
  title: 'App Preferences | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerPreferencesPage() {
  return <CustomerPreferencesClient />;
}
