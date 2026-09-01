import { Metadata } from 'next';
import { CustomerForgotPasswordClient } from '@/components/customer-forgot-password-client';

export const metadata: Metadata = {
  title: 'Forgot Password | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerForgotPasswordPage() {
  return <CustomerForgotPasswordClient />;
}
