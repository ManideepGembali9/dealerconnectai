import { Metadata } from 'next';
import { CustomerReviewsClient } from '@/components/customer-reviews-client';

export const metadata: Metadata = {
  title: 'My Reviews & Ratings | DealerConnect AI',
  robots: { index: false, follow: false },
};

export default function CustomerReviewsPage() {
  return <CustomerReviewsClient />;
}
