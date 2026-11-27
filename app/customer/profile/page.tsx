import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Customer Profile | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerProfilePage() {
  redirect('/profile');
}
