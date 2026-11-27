import type { Metadata } from 'next';
import { NearbyClient } from '@/components/nearby-client';

export const metadata: Metadata = {
  title: 'Nearby Verified Dealers — Find Local Showrooms Closest to You',
  description:
    'Discover nearby shops, calculate driving distance, check store ratings, and connect via WhatsApp or phone.',
};

export default function NearbyPage() {
  return <NearbyClient />;
}
