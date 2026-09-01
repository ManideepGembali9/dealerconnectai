'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Phone, Clock, Package, Store } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';

export function CustomerEnquiriesClient() {
  const router = useRouter();
  const { role, customer, loading: authLoading } = useAuth();
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && role !== 'customer') { router.push('/customer/login'); return; }
    if (customer) loadEnquiries();
  }, [authLoading, role, customer]);

  const loadEnquiries = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('enquiries')
        .select('*, dealer:dealer_id(*), product:product_id(*)')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      setEnquiries(data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!customer) return null;

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-warning/15 text-warning' },
    responded: { label: 'Responded', className: 'bg-primary/15 text-primary' },
    completed: { label: 'Completed', className: 'bg-success/15 text-success' },
    cancelled: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive' },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Your Enquiries</h1>
      <p className="mb-6 text-sm text-muted-foreground">Enquiries you&apos;ve sent to dealers</p>

      {enquiries.length > 0 ? (
        <div className="space-y-3">
          {enquiries.map((e) => {
            const st = statusConfig[e.status ?? 'pending'] ?? statusConfig.pending;
            return (
              <Card key={e.id} className="p-4">
                <div className="flex items-start gap-3">
                  {e.product?.images?.[0] && (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img src={e.product.images[0]} alt={e.product.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {e.product && <Link href={`/product/${e.product.id}`} className="text-sm font-semibold hover:text-primary">{e.product.name}</Link>}
                        {e.dealer && <Link href={`/dealer/${e.dealer.id}`} className="block text-xs text-muted-foreground hover:text-primary">{e.dealer.shop_name}</Link>}
                      </div>
                      <Badge className={st.className}>{st.label}</Badge>
                    </div>
                    {e.message && <p className="mt-2 text-sm text-muted-foreground">{e.message}</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(e.created_at)}</span>
                      {e.dealer?.phone && (
                        <a href={`tel:${e.dealer.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3 w-3" /> Contact Dealer
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No enquiries yet. When you contact a dealer about a product, it will appear here.</p>
          <Link href="/search" className="mt-3 inline-block"><Button variant="outline">Browse Products</Button></Link>
        </Card>
      )}
    </div>
  );
}
