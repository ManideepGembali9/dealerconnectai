'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Search,
  Star,
  Store,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SendEnquiryDialog } from '@/components/send-enquiry-dialog';
import { fetchApprovedDealers, fetchProducts } from '@/lib/data';
import { useApp } from '@/lib/providers';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Dealer, Product } from '@/lib/types';

export function AllShopsClient() {
  const { location } = useApp();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [enquiryDealer, setEnquiryDealer] = useState<Dealer | null>(null);

  const loadShopsData = useCallback(async () => {
    setLoading(true);
    try {
      const [dls, prods] = await Promise.all([
        fetchApprovedDealers(200),
        fetchProducts({ limit: 500 }),
      ]);
      const activeApproved = (dls ?? []).filter((d) => d.status === 'approved');
      setDealers(activeApproved);
      setProducts(prods ?? []);
    } catch (err) {
      console.error('Failed to load shops:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtimeSync(['dealers', 'products', 'reviews'], loadShopsData, {
    onReconnect: loadShopsData,
  });

  useEffect(() => {
    loadShopsData();
    const handleSync = () => loadShopsData();
    window.addEventListener('dc-sync-event', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('dc-sync-event', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadShopsData]);

  // Group available products by dealer_id
  const productsByDealer = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of products) {
      if (p.dealer_id && p.stock_status !== 'out_of_stock') {
        if (!map[p.dealer_id]) map[p.dealer_id] = [];
        map[p.dealer_id].push(p);
      }
    }
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter((d) => {
      const dealerProds = productsByDealer[d.id] || [];
      return (
        d.shop_name.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        d.address?.toLowerCase().includes(q) ||
        d.category?.name?.toLowerCase().includes(q) ||
        d.pin_code?.toLowerCase().includes(q) ||
        dealerProds.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }, [dealers, productsByDealer, search]);

  return (
    <div
      className="mx-auto w-full max-w-7xl px-3.5 sm:px-6 pt-4 sm:pt-6"
      style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Page Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <Link
              href="/nearby"
              aria-label="Back to Nearby Shops"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">All Shops</h1>
              <p className="text-xs text-muted-foreground">
                {loading ? 'Loading verified shops...' : `${dealers.length} verified active shops`}
                {location.label ? ` near ${location.label}` : ''}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="hidden md:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Home
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shop, city, category, or product..."
          aria-label="Search shops"
          className="h-11 pl-10 pr-9 text-sm rounded-2xl"
        />
        {search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 rounded-xl bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <Card className="p-12 rounded-3xl text-center space-y-3 border-dashed">
          <Store className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="text-base font-bold text-foreground">
            {search ? `No shops found for "${search}"` : 'No shops available'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {search
              ? 'Try searching a different shop name, city, category, or product.'
              : 'Check back soon — new verified shops are added regularly.'}
          </p>
          {search && (
            <Button variant="outline" size="sm" onClick={() => setSearch('')} className="rounded-xl">
              Clear Search
            </Button>
          )}
        </Card>
      )}

      {/* Shops Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((dealer) => {
            const availableProducts = productsByDealer[dealer.id] || [];
            const productCount = availableProducts.length || dealer.product_count || 0;
            return (
              <Card
                key={dealer.id}
                className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div>
                  <Link href={`/dealer/${dealer.id}`} className="flex items-start gap-3 min-w-0 group">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                      <Image
                        src={
                          dealer.logo_url ??
                          'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=200'
                        }
                        alt={dealer.shop_name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {dealer.shop_name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {dealer.category?.name ?? 'General Store'}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span className="font-semibold text-foreground">{dealer.rating.toFixed(1)}</span>
                        <span className="text-muted-foreground">({dealer.rating_count})</span>
                      </div>
                    </div>
                  </Link>

                  {/* Location & Contact Details */}
                  <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      <span className="line-clamp-2 leading-snug">
                        {[dealer.address, dealer.city, dealer.state, dealer.pin_code]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>

                    {dealer.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-foreground" />
                        <span className="font-medium text-foreground truncate">{dealer.phone}</span>
                      </div>
                    )}

                    {/* Available Products Preview */}
                    <div className="flex items-start gap-1.5 text-muted-foreground pt-0.5">
                      <Package className="h-3.5 w-3.5 shrink-0 mt-0.5 text-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-foreground">
                          {productCount} {productCount === 1 ? 'product' : 'products'} available
                        </span>
                        {availableProducts.length > 0 && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {availableProducts
                              .slice(0, 3)
                              .map((p) => p.name)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {dealer.delivery_available && (
                      <Badge variant="outline" className="text-[10px] border-success/40 text-success px-1.5">
                        Delivery
                      </Badge>
                    )}
                    {dealer.pickup_available && (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary px-1.5">
                        Pickup
                      </Badge>
                    )}
                    {dealer.whatsapp && (
                      <Badge variant="outline" className="text-[10px] border-success/40 text-success px-1.5">
                        WhatsApp
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs rounded-xl font-semibold">
                      <Link href={`/dealer/${dealer.id}`}>View Shop</Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setEnquiryDealer(dealer)}
                      className="flex-1 h-8 text-xs rounded-xl font-semibold"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Enquire
                    </Button>
                    {dealer.phone && (
                      <Button asChild size="sm" variant="outline" className="h-8 px-2.5 rounded-xl">
                        <a href={`tel:${dealer.phone}`} aria-label={`Call ${dealer.shop_name}`}>
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <SendEnquiryDialog
        open={Boolean(enquiryDealer)}
        onOpenChange={(open) => {
          if (!open) setEnquiryDealer(null);
        }}
        dealer={enquiryDealer}
      />
    </div>
  );
}
