'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Star, MapPin, Phone, MessageCircle, Navigation, Clock, ShoppingBag,
  Store, Check, Truck, Globe, ChevronLeft, Share2, Heart, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from '@/components/product-card';
import { useApp } from '@/lib/providers';
import { fetchDealerById, fetchProducts, fetchReviewsByDealer } from '@/lib/data';
import { haversineKm, formatDistance } from '@/lib/geo';
import { timeAgo } from '@/lib/format';
import type { Dealer, Product, Review } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function DealerProfileClient({ id }: { id: string }) {
  const router = useRouter();
  const { location, savedDealers: saved, toggleSavedDealer } = useApp();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, prods, revs] = await Promise.all([
          fetchDealerById(id),
          fetchProducts({ dealerId: id, limit: 100 }),
          fetchReviewsByDealer(id),
        ]);
        setDealer(d);
        setProducts(prods);
        setReviews(revs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!dealer) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Shop not found</h1>
        <Button onClick={() => router.push('/nearby')}>Find nearby shops</Button>
      </div>
    );
  }

  const distance = dealer.map_lat && dealer.map_lng && location.lat && location.lng
    ? haversineKm(location.lat, location.lng, dealer.map_lat, dealer.map_lng)
    : null;

  const isSaved = saved.includes(dealer.id);
  const filteredProducts = productSearch
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.tags.some((tag) => tag.includes(productSearch.toLowerCase())))
    : products;

  const avgReviewRating = reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : dealer.rating;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: dealer.shop_name, url }); } catch {} }
    else { try { await navigator.clipboard.writeText(url); toast.success('Link copied!'); } catch {} }
  };

  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 sm:h-64">
        {dealer.banner_url && <Image src={dealer.banner_url} alt={dealer.shop_name} fill sizes="100vw" className="object-cover" priority />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <button onClick={() => router.back()} className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-background"><ChevronLeft className="h-5 w-5" /></button>
        <button onClick={handleShare} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-background"><Share2 className="h-5 w-5" /></button>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Profile header */}
        <div className="relative -mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-background shadow-lg sm:h-32 sm:w-32">
            <Image src={dealer.logo_url ?? 'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=200'} alt={dealer.shop_name} fill sizes="128px" className="object-cover" />
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">{dealer.shop_name}</h1>
              <Badge className="bg-success/15 text-success"><Check className="mr-1 h-3 w-3" /> Verified</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{dealer.category?.name} · {dealer.owner_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" /> {dealer.rating.toFixed(1)} ({dealer.rating_count})</span>
              <span className="flex items-center gap-1 text-muted-foreground"><ShoppingBag className="h-4 w-4" /> {products.length} products</span>
              {distance !== null && <span className="flex items-center gap-1 font-medium text-primary"><MapPin className="h-4 w-4" /> {formatDistance(distance)} away</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant={isSaved ? 'default' : 'outline'} onClick={() => toggleSavedDealer(dealer.id)}>
              <Heart className={cn('mr-1.5 h-4 w-4', isSaved && 'fill-current')} /> {isSaved ? 'Saved' : 'Save Shop'}
            </Button>
          </div>
        </div>

        {/* Contact bar */}
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {dealer.address}, {dealer.city}, {dealer.state} - {dealer.pin_code}</span>
            {dealer.delivery_available && <Badge variant="outline" className="text-success"><Truck className="mr-1 h-3 w-3" /> Delivery</Badge>}
            {dealer.pickup_available && <Badge variant="outline"><Store className="mr-1 h-3 w-3" /> Pickup</Badge>}
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline"><Link href={`tel:${dealer.phone}`}><Phone className="mr-1 h-4 w-4" /> Call</Link></Button>
            {dealer.whatsapp && <Button asChild size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10"><Link href={`https://wa.me/91${dealer.whatsapp}`} target="_blank"><MessageCircle className="mr-1 h-4 w-4" /> WhatsApp</Link></Button>}
            <Button asChild size="sm"><Link href={`https://www.google.com/maps/dir/?api=1&destination=${dealer.map_lat},${dealer.map_lng}`} target="_blank"><Navigation className="mr-1 h-4 w-4" /> Directions</Link></Button>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="products" className="mt-6">
          <TabsList>
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search this shop's products..."
              className="mb-4 h-10 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none focus:border-primary"
            />
            {filteredProducts.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">No products found in this shop.</Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((p) => <ProductCard key={p.id} product={p} distanceKm={distance ?? undefined} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="about" className="mt-4">
            <Card className="p-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoRow icon={Store} label="Shop Name" value={dealer.shop_name} />
                <InfoRow icon={ShoppingBag} label="Owner" value={dealer.owner_name} />
                <InfoRow icon={MapPin} label="Address" value={`${dealer.address}, ${dealer.village ?? ''} ${dealer.city}, ${dealer.state} - ${dealer.pin_code}`} />
                <InfoRow icon={Phone} label="Phone" value={dealer.phone} />
                {dealer.whatsapp && <InfoRow icon={MessageCircle} label="WhatsApp" value={dealer.whatsapp} />}
                {dealer.gst_number && <InfoRow icon={Check} label="GST Number" value={dealer.gst_number} />}
                <InfoRow icon={ShoppingBag} label="Total Products" value={String(products.length)} />
                <InfoRow icon={Truck} label="Home Delivery" value={dealer.delivery_available ? `Yes (within ${dealer.home_delivery_radius_km} km)` : 'No'} />
              </dl>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5 text-center lg:col-span-1">
                <p className="text-4xl font-bold">{avgReviewRating.toFixed(1)}</p>
                <div className="mt-2 flex justify-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-5 w-5', i <= Math.round(avgReviewRating) ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />)}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{reviews.length} reviews</p>
              </Card>
              <div className="space-y-3 lg:col-span-2">
                {reviews.length === 0 ? (
                  <Card className="p-8 text-center text-sm text-muted-foreground">No reviews yet.</Card>
                ) : reviews.map((rev) => (
                  <Card key={rev.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{rev.customer_name[0]}</div>
                        <div>
                          <p className="text-sm font-medium">{rev.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(rev.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-3.5 w-3.5', i <= rev.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />)}</div>
                    </div>
                    {rev.comment && <p className="mt-2 text-sm text-muted-foreground">{rev.comment}</p>}
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hours" className="mt-4">
            <Card className="p-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" /> Working Hours</h3>
              <dl className="space-y-2">
                {DAYS.map((day, i) => {
                  const hours = dealer.working_hours?.[day];
                  const today = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase() === day;
                  return (
                    <div key={day} className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-sm', today && 'bg-primary/5')}>
                      <dt className={cn(today && 'font-semibold text-primary')}>{DAY_LABELS[i]}</dt>
                      <dd className={cn(!hours || hours === 'closed' ? 'text-destructive' : '')}>
                        {hours === 'closed' || !hours ? 'Closed' : hours === '24hours' ? '24 Hours' : hours}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
