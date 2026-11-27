import type { Metadata } from 'next';
import { AllShopsClient } from '@/components/all-shops-client';

export const metadata: Metadata = {
  title: 'All Shops | DealerConnect AI',
  description: 'Browse all verified local shops and showrooms near you.',
};

export default function ShopsPage() {
  return <AllShopsClient />;
}
