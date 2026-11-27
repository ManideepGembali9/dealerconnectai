import { Metadata } from 'next';
import { CustomerLoginClient } from '@/components/customer-login-client';

export const metadata: Metadata = {
  title: 'Customer Login | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerLoginPage() {
  return <CustomerLoginClient />;
}
