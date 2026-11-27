import type { Metadata } from 'next';
import { DealerProfileClient } from '@/components/dealer-profile-client';
import { JsonLd, dealerSchema } from '@/components/json-ld';
import { fetchDealerById } from '@/lib/data';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const dealer = await fetchDealerById(params.id);
    if (!dealer) {
      return {
        title: 'Dealer Showroom Not Found',
      };
    }
    return {
      title: `${dealer.shop_name} — Local Dealer in ${dealer.city}`,
      description:
        dealer.description ||
        `Visit ${dealer.shop_name} in ${dealer.city}, PIN ${dealer.pin_code}. Check live product stock, ratings, and contact via phone or WhatsApp.`,
    };
  } catch {
    return { title: 'Local Dealer Profile' };
  }
}

export default async function DealerPage({ params }: { params: { id: string } }) {
  let schema = null;
  try {
    const dealer = await fetchDealerById(params.id);
    if (dealer) {
      schema = dealerSchema({
        shop_name: dealer.shop_name,
        description: dealer.description,
        city: dealer.city,
        state: dealer.state,
        address: dealer.address,
        phone: dealer.phone,
        rating: dealer.rating,
        rating_count: dealer.rating_count,
        logo_url: dealer.logo_url,
        id: dealer.id,
      });
    }
  } catch {}

  return (
    <>
      {schema && <JsonLd data={schema} />}
      <DealerProfileClient id={params.id} />
    </>
  );
}
