import type { Metadata } from 'next';
import { CompareClient } from '@/components/compare-client';

export const metadata: Metadata = {
  title: 'Compare Products — Compare Specs, Stock, and Dealer Prices',
  description:
    'Side-by-side comparison of local store prices, warranty terms, specifications, and availability across nearby dealers.',
};

export default function ComparePage() {
  return <CompareClient />;
}
