'use client';

import { ProductCard } from '@/components/product-card';
import { SendEnquiryDialog } from '@/components/send-enquiry-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchDealerById, fetchProducts, fetchReviewsForDealer } from '@/lib/data';
import { apiSync } from '@/lib/api-sync';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { formatDistance, haversineKm } from '@/lib/geo';
import { useApp } from '@/lib/providers';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Dealer, Product, Review } from '@/lib/supabase';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronLeft,
  Clock,
  Heart,
  MapPin,
  MessageCircle, Navigation,
  Phone,
  Share2,
  ShoppingBag,
  Star,
  Store,
  Truck
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function DealerProfileClient({ id }: { id: string }) {
  const router = useRouter();
  const { location, savedDealers: saved, toggleSavedDealer } = useApp();
  const { customer, customerAuthenticated } = useAuth();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [shopReviewForm, setShopReviewForm] = useState({ rating: 5, comment: '' });
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const loadDealerData = async () => {
    try {
      const [d, prods, revResp] = await Promise.all([
        fetchDealerById(id),
        fetchProducts({ dealerId: id, limit: 100 }),
        typeof window !== 'undefined'
          ? apiSync.fetchReviews({ dealerId: id })
          : fetchReviewsForDealer(id).then((list: Review[]) => ({ reviews: list, canReview: false, alreadyReviewed: false })),
      ]);
      setDealer(d);
      setProducts(prods);
      setReviews(revResp.reviews || []);
      setCanReview(Boolean(revResp.canReview));
      setAlreadyReviewed(Boolean(revResp.alreadyReviewed));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadDealerData();
    const handleSync = () => loadDealerData();
    window.addEventListener('dc-sync-event', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('dc-sync-event', handleSync);
      window.removeEventListener('storage', handleSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useRealtimeSync(['dealers', 'products', 'reviews', 'enquiries'], () => loadDealerData(), {
    onReconnect: () => loadDealerData(),
  });

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

  const avgReviewRating =
    reviews.length > 0
      ? Number((reviews.reduce((a, r) => a + Number(r.rating || 0), 0) / reviews.length).toFixed(1))
      : Number(dealer.rating || 0);

  const myShopReview = customer
    ? reviews.find(
        (r) =>
          (r.target_type === 'dealer' || !r.product_id) &&
          (r.customer_id === customer.id ||
            (customer.email && r.customer_email?.toLowerCase() === customer.email.toLowerCase()))
      ) || null
    : null;

  const handleSubmitShopReview = async () => {
    setReviewFeedback(null);
    if (!customerAuthenticated || !customer) {
      setReviewFeedback({ type: 'error', text: 'Please sign in as a Customer to review this shop.' });
      return;
    }
    if (shopReviewForm.comment.trim().length < 5) {
      setReviewFeedback({ type: 'error', text: 'Comment must be at least 5 characters.' });
      return;
    }
    setSubmittingReview(true);
    try {
      if (editingReviewId) {
        await apiSync.updateReview({
          id: editingReviewId,
          action: 'edit',
          rating: shopReviewForm.rating,
          comment: shopReviewForm.comment.trim(),
        });
        setEditingReviewId(null);
        setReviewFeedback({ type: 'success', text: 'Shop review updated!' });
      } else {
        await apiSync.createReview({
          dealer_id: dealer.id,
          product_id: null,
          customer_name: customer.full_name || 'Customer',
          rating: shopReviewForm.rating,
          comment: shopReviewForm.comment.trim(),
        });
        setReviewFeedback({ type: 'success', text: 'Shop review published!' });
      }
      setShopReviewForm({ rating: 5, comment: '' });
      await loadDealerData();
    } catch (err: unknown) {
      setReviewFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit shop review',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteShopReview = async (revId: string) => {
    try {
      await apiSync.deleteReview(revId);
      toast.success('Review deleted.');
      await loadDealerData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete review');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: dealer.shop_name, url }); } catch { } }
    else { try { await navigator.clipboard.writeText(url); toast.success('Link copied!'); } catch { } }
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEnquiryOpen(true)}>
              <MessageCircle className="mr-1.5 h-4 w-4" /> Send Enquiry
            </Button>
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
              <div className="space-y-4 lg:col-span-1">
                <Card className="p-5 text-center">
                  <p className="text-4xl font-bold">{avgReviewRating.toFixed(1)}</p>
                  <div className="mt-2 flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-5 w-5', i <= Math.round(avgReviewRating) ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />)}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{reviews.length} verified reviews</p>
                </Card>

                <Card className="p-5 space-y-3">
                  <h3 className="text-sm font-bold">{editingReviewId ? 'Edit Your Shop Review' : 'Review This Showroom'}</h3>
                  {!customerAuthenticated ? (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Sign in as a Customer to submit or manage reviews for {dealer.shop_name}.</p>
                      <Link href={`/customer/login?redirect=/dealer/${dealer.id}`}>
                        <Button size="sm" variant="outline" className="w-full mt-1">Sign In as Customer</Button>
                      </Link>
                    </div>
                  ) : !editingReviewId && (alreadyReviewed || myShopReview) ? (
                    <div className="space-y-2 text-xs">
                      <p className="text-muted-foreground">You have already reviewed this shop{myShopReview ? ` (${myShopReview.rating}★)` : ''}.</p>
                      {myShopReview && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs"
                            onClick={() => {
                              setEditingReviewId(myShopReview.id);
                              setShopReviewForm({ rating: myShopReview.rating, comment: myShopReview.comment || '' });
                            }}
                          >
                            Edit Review
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-destructive"
                            onClick={() => handleDeleteShopReview(myShopReview.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : !editingReviewId && !canReview ? (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Verified interaction required: Send an enquiry to {dealer.shop_name} before reviewing this shop.</p>
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setEnquiryOpen(true)}>
                        Send Enquiry First
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs">Rating</Label>
                        <div className="flex gap-1 pt-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setShopReviewForm((p) => ({ ...p, rating: i }))}
                              aria-label={`Rate ${i} stars`}
                            >
                              <Star className={cn('h-5 w-5', i <= shopReviewForm.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="shop-rev-comment" className="text-xs">Your Experience</Label>
                        <Textarea
                          id="shop-rev-comment"
                          value={shopReviewForm.comment}
                          onChange={(e) => setShopReviewForm((p) => ({ ...p, comment: e.target.value }))}
                          placeholder="Share shop pricing, delivery, or staff experience..."
                          rows={3}
                        />
                      </div>
                      {reviewFeedback && (
                        <div className={cn('rounded-lg border px-3 py-2 text-xs', reviewFeedback.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700' : 'border-destructive/30 bg-destructive/10 text-destructive')}>
                          {reviewFeedback.text}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button onClick={handleSubmitShopReview} disabled={submittingReview} className="flex-1 text-xs">
                          {submittingReview ? 'Saving...' : editingReviewId ? 'Save Update' : 'Post Review'}
                        </Button>
                        {editingReviewId && (
                          <Button size="sm" variant="ghost" onClick={() => { setEditingReviewId(null); setShopReviewForm({ rating: 5, comment: '' }); }}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              </div>
              <div className="space-y-3 lg:col-span-2">
                {reviews.length === 0 ? (
                  <Card className="p-8 text-center text-sm text-muted-foreground">No reviews yet.</Card>
                ) : reviews.map((rev) => {
                  const isOwn = Boolean(
                    customer &&
                      (rev.customer_id === customer.id ||
                        (customer.email && rev.customer_email?.toLowerCase() === customer.email.toLowerCase()))
                  );
                  return (
                    <Card key={rev.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{rev.customer_name[0]}</div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium">{rev.customer_name}</p>
                              {rev.is_verified_interaction && (
                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">Verified</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{timeAgo(rev.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-3.5 w-3.5', i <= rev.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />)}</div>
                          {isOwn && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => handleDeleteShopReview(rev.id)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                      {rev.comment && <p className="text-sm text-muted-foreground">{rev.comment}</p>}
                      {rev.dealer_response && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                          <p className="font-bold text-emerald-700 dark:text-emerald-400">Reply from {rev.responded_by || dealer.shop_name}</p>
                          <p className="mt-1 text-foreground">{rev.dealer_response}</p>
                        </div>
                      )}
                    </Card>
                  );
                })}
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
      <SendEnquiryDialog open={enquiryOpen} onOpenChange={setEnquiryOpen} dealer={dealer} />
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
