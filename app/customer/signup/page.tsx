import { Metadata } from 'next';
import { CustomerSignupClient } from '@/components/customer-signup-client';

export const metadata: Metadata = {
  title: 'Customer Sign Up | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerSignupPage() {
  return <CustomerSignupClient />;
}
