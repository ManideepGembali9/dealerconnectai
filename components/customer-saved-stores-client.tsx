'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MapPin, Star, Store, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/providers';
import { fetchApprovedDealers } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import type { Dealer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CustomerSubpageShell } from '@/components/profile/customer-subpage-shell';

export function CustomerSavedStoresClient() {
  const { customer } = useAuth();
  const { savedDealers, toggleSavedDealer } = useApp();
  const [stores, setStores] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadSavedStores() {
      if (!customer) {
        if (active) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [allDealers, favRes] = await Promise.all([
          fetchApprovedDealers(200),
          supabase
            .from('customer_favorites')
            .select('dealer_id')
            .eq('user_id', customer.id)
            .eq('type', 'dealer'),
        ]);
        if (!active) return;

        const favIds = ((favRes.data || []) as Array<{ dealer_id: string | null }>)
          .map((row) => row.dealer_id)
          .filter((id): id is string => Boolean(id));

        const combinedIds = new Set([...savedDealers, ...favIds]);
        setStores(allDealers.filter((d) => combinedIds.has(d.id)));
      } catch {
        if (active) setStores([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSavedStores();
    return () => {
      active = false;
    };
  }, [customer, savedDealers]);

  const handleRemoveStore = async (dealerId: string) => {
    if (savedDealers.includes(dealerId)) {
      toggleSavedDealer(dealerId);
    }
    if (customer) {
      try {
        await supabase
          .from('customer_favorites')
          .delete()
          .eq('user_id', customer.id)
          .eq('dealer_id', dealerId);
      } catch {}
    }
    setStores((prev) => prev.filter((s) => s.id !== dealerId));
    toast.success('Store removed from Saved Stores.');
  };

  return (
    <CustomerSubpageShell
      title="Saved Stores"
      subtitle="Verified local dealers and shops you bookmarked for quick access."
      redirectPath="/customer/saved-stores"
    >
      {customer && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl border border-[#292929] bg-[#151515] animate-pulse"
                />
              ))}
            </div>
          ) : stores.length === 0 ? (
            <div className="rounded-2xl border border-[#292929] bg-[#151515] p-8 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#202020] border border-[#292929]">
                <Store className="h-5 w-5 text-[#FFFFFF]" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[#FFFFFF]">No Saved Stores Yet</h2>
                <p className="text-xs text-[#A0A0A0] max-w-sm mx-auto">
                  Explore trusted dealers near you and tap the heart icon on any store page to save it here.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <Button
                  asChild
                  className="h-10 rounded-xl bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#E5E5E5] font-bold text-xs px-5"
                >
                  <Link href="/nearby">Browse Nearby Shops</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-xl border-[#292929] bg-[#202020] text-[#FFFFFF] hover:bg-[#292929] font-semibold text-xs px-4"
                >
                  <Link href="/categories">Explore Categories</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="rounded-2xl border border-[#292929] bg-[#151515] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#202020] border border-[#292929]">
                      <Store className="h-5 w-5 text-[#FFFFFF]" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-[#FFFFFF] truncate">{store.shop_name}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#202020] border border-[#292929] px-2 py-0.5 text-[11px] font-semibold text-[#FFFFFF]">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {Number(store.rating || 4.5).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-[#A0A0A0] flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>
                          {store.city}
                          {store.state ? `, ${store.state}` : ''}
                          {store.pin_code ? ` (${store.pin_code})` : ''}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-[#A0A0A0]">
                        {store.delivery_available && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#202020] px-2 py-0.5">
                            <Truck className="h-3 w-3" /> Delivery
                          </span>
                        )}
                        {store.pickup_available && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#202020] px-2 py-0.5">
                            Store Pickup
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      asChild
                      size="sm"
                      className="h-9 rounded-xl bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#E5E5E5] font-bold text-xs px-3.5 gap-1.5"
                    >
                      <Link href={`/dealer/${store.id}`}>
                        <span>Visit Store</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveStore(store.id)}
                      className="h-9 rounded-xl border-[#292929] bg-[#202020] text-[#A0A0A0] hover:text-red-400 hover:bg-[#292929] px-2.5"
                      aria-label={`Remove ${store.shop_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CustomerSubpageShell>
  );
}
