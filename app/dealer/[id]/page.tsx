import { DealerProfileClient } from '@/components/dealer-profile-client';
import { JsonLd, dealerSchema } from '@/components/json-ld';
import { supabase } from '@/lib/supabase';
import type { Dealer } from '@/lib/supabase';

export default async function DealerPage({ params }: { params: { id: string } }) {
  let schema = null;
  try {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('*')
      .eq('id', params.id)
      .maybeSingle<Dealer>();
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
  } catch { /* schema is optional */ }

  return (
    <>
      {schema && <JsonLd data={schema} />}
      <DealerProfileClient id={params.id} />
    </>
  );
}
