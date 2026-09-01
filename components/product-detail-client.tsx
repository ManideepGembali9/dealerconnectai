'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Star, MapPin, Phone, MessageCircle, Navigation, Heart, Share2, Scale,
  ShoppingCart, Check, Clock, Truck, Store, Zap, Shield, ChevronLeft,
  ChevronRight, Sparkles, Package, Award, ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductCard } from '@/components/product-card';
import { useApp } from '@/lib/providers';
import { fetchProductById, fetchSimilarProducts, fetchProductsByName, fetchReviewsByDealer } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { formatINR, getEffectivePrice, getDiscountPercent, timeAgo } from '@/lib/format';
import { haversineKm, formatDistance, estimateDriveTime } from '@/lib/geo';
import type { Product, Review } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const stockConfig = {
  in_stock: { label: 'In Stock', color: 'text-success', bg: 'bg-success/10', dot: 'bg-success' },
  limited: { label: 'Limited Stock', color: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning' },
  out_of_stock: { label: 'Out of Stock', color: 'text-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive' },
  restocking: { label: 'Restocking Soon', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
};

export function ProductDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { location, wishlist, toggleWishlist, compare, toggleCompare, addRecentlyViewed, t } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [allVariants, setAllVariants] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageIdx, setImageIdx] = useState(0);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (product) addRecentlyViewed(product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const p = await fetchProductById(id);
        setProduct(p);
        if (p) {
          setImageIdx(0);
          const [sim, variants] = await Promise.all([
            fetchSimilarProducts(p, 8),
            fetchProductsByName(p.name),
          ]);
          setSimilar(sim);
          setAllVariants(variants);
          if (p.dealer_id) {
            const revs = await fetchReviewsByDealer(p.dealer_id);
            setReviews(revs);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Compute dealer variants with distance
  const dealerVariants = useMemo(() => {
    return allVariants
      .filter((p) => p.stock_status !== 'out_of_stock' || p.id === product?.id)
      .map((p) => {
        const d = p.dealer;
        const distance = d && d.map_lat && d.map_lng && location.lat && location.lng
          ? haversineKm(location.lat, location.lng, d.map_lat, d.map_lng)
          : d && location.pinCode && d.pin_code === location.pinCode ? 0.5 : null;
        return { product: p, distance };
      })
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  }, [allVariants, location, product?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-xl bg-muted" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-24 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <Package className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Product not found</h1>
        <Button onClick={() => router.push('/search')}>Back to search</Button>
      </div>
    );
  }

  const price = getEffectivePrice(product.price, product.discount_price);
  const discount = getDiscountPercent(product.price, product.discount_price);
  const stock = stockConfig[product.stock_status];
  const inWishlist = wishlist.includes(product.id);
  const inCompare = compare.includes(product.id);
  const images = product.images.length > 0 ? product.images : ['https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=800'];
  const dealer = product.dealer;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); toast.success('Link copied!'); } catch {}
    }
  };

  const submitReview = async () => {
    if (!reviewForm.name.trim() || !reviewForm.comment.trim()) {
      toast.error('Please fill your name and comment');
      return;
    }
    if (!dealer) return;
    setSubmittingReview(true);
    try {
      const { data, error } = await supabase.from('reviews').insert({
        dealer_id: dealer.id,
        product_id: product.id,
        customer_name: reviewForm.name,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      }).select().single();
      if (error) throw error;
      setReviews((prev) => [data, ...prev]);
      setReviewForm({ name: '', rating: 5, comment: '' });
      toast.success('Review submitted!');
    } catch (e) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-3 w-3" />
        {product.category && <><Link href={`/search?category=${product.category.slug}`} className="hover:text-primary">{product.category.name}</Link><ChevronRight className="h-3 w-3" /></>}
        <span className="line-clamp-1 text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Image gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            <Image src={images[imageIdx]} alt={product.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority />
            {discount > 0 && <Badge className="absolute left-3 top-3 bg-destructive text-destructive-foreground">-{discount}%</Badge>}
            {images.length > 1 && (
              <>
                <button onClick={() => setImageIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-background">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => setImageIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-background">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {images.map((img, i) => (
                <button key={i} onClick={() => setImageIdx(i)} className={cn('relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2', i === imageIdx ? 'border-primary' : 'border-border')}>
                  <Image src={img} alt={`${product.name} ${i + 1}`} fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
          {product.ai_verified && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"><Sparkles className="h-4 w-4" /></div>
              <div className="text-sm">
                <p className="font-medium text-accent">AI Verified Image</p>
                <p className="text-xs text-muted-foreground">Image analyzed for authenticity and category match</p>
              </div>
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          <div className="flex items-center gap-2">
            {product.brand && <Badge variant="secondary">{product.brand.name}</Badge>}
            {product.category && <Badge variant="outline">{product.category.name}</Badge>}
            {product.is_trending && <Badge className="bg-warning/15 text-warning"><Zap className="mr-1 h-3 w-3" /> Trending</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
          {product.model && <p className="mt-1 text-sm text-muted-foreground">Model: {product.model} · SKU: {product.sku ?? 'N/A'}</p>}

          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={cn('h-4 w-4', i <= Math.round(dealer?.rating ?? 0) ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />
              ))}
              <span className="ml-1 text-sm font-medium">{dealer?.rating.toFixed(1) ?? 'N/A'}</span>
              <span className="text-sm text-muted-foreground">({dealer?.rating_count ?? 0} reviews)</span>
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{formatINR(price)}</span>
            {discount > 0 && <span className="text-lg text-muted-foreground line-through">{formatINR(product.price)}</span>}
            {discount > 0 && <Badge className="bg-success/15 text-success">Save {formatINR(product.price - (product.discount_price ?? 0))}</Badge>}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium', stock.bg, stock.color)}>
              <span className={cn('h-2 w-2 rounded-full', stock.dot)} />
              {product.stock_status === 'in_stock' ? `${stock.label} (${product.stock_qty})` : stock.label}
            </span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{product.description}</p>

          {product.features.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {product.features.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-success" /> {f}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant={inWishlist ? 'default' : 'outline'} onClick={() => toggleWishlist(product.id)} className="flex-1">
              <Heart className={cn('mr-1.5 h-4 w-4', inWishlist && 'fill-current')} /> {inWishlist ? 'Saved' : 'Save'}
            </Button>
            <Button variant={inCompare ? 'default' : 'outline'} onClick={() => toggleCompare(product.id)} className="flex-1">
              <Scale className="mr-1.5 h-4 w-4" /> {inCompare ? 'Comparing' : 'Compare'}
            </Button>
            <Button variant="outline" onClick={handleShare}><Share2 className="h-4 w-4" /></Button>
          </div>

          {/* Dealer contact actions */}
          {dealer && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link href={`tel:${dealer.phone}`}><Phone className="mr-1.5 h-4 w-4" /> Call Dealer</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href={`/messages?dealer=${dealer.id}`}><MessageCircle className="mr-1.5 h-4 w-4" /> Chat</Link>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href={`/dealer/${dealer.id}`}><Store className="mr-1.5 h-4 w-4" /> Visit Shop</Link>
              </Button>
            </div>
          )}

          {/* Find Near Me */}
          <Button
            onClick={() => router.push(`/search?q=${encodeURIComponent(product.name)}&sort=nearest`)}
            className="mt-3 w-full blue-gradient text-white hover:opacity-90"
          >
            <MapPin className="mr-2 h-4 w-4" /> Find Near Me
          </Button>

          {/* Key specs */}
          {Object.keys(product.specifications).length > 0 && (
            <Card className="mt-5 p-4">
              <h3 className="mb-3 text-sm font-semibold">Quick Specs</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {Object.entries(product.specifications).slice(0, 8).map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-xs capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {/* Delivery options */}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {product.delivery_available && <span className="flex items-center gap-1.5 text-success"><Truck className="h-4 w-4" /> Home Delivery</span>}
            {product.pickup_available && <span className="flex items-center gap-1.5 text-primary"><Store className="h-4 w-4" /> Store Pickup</span>}
            {product.warranty && <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> {product.warranty}</span>}
          </div>
        </div>
      </div>

      {/* AVAILABLE DEALERS COMPARISON TABLE */}
      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Available at {dealerVariants.length} nearby shop{dealerVariants.length > 1 ? 's' : ''}</h2>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Shop</th>
                  <th className="px-4 py-3 text-left font-semibold">Price</th>
                  <th className="px-4 py-3 text-left font-semibold">Stock</th>
                  <th className="px-4 py-3 text-left font-semibold">Distance</th>
                  <th className="px-4 py-3 text-left font-semibold">Rating</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dealerVariants.map(({ product: p, distance }) => {
                  const d = p.dealer;
                  if (!d) return null;
                  const pPrice = getEffectivePrice(p.price, p.discount_price);
                  const isCurrent = p.id === product.id;
                  const isCheapest = pPrice === Math.min(...dealerVariants.map((v) => getEffectivePrice(v.product.price, v.product.discount_price)));
                  const sConfig = stockConfig[p.stock_status];
                  return (
                    <tr key={p.id} className={cn('border-b border-border/50 transition-colors hover:bg-muted/30', isCurrent && 'bg-primary/5')}>
                      <td className="px-4 py-3">
                        <Link href={`/dealer/${d.id}`} className="flex items-center gap-2">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <Image src={d.logo_url ?? 'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=80'} alt={d.shop_name} fill sizes="40px" className="object-cover" />
                          </div>
                          <div>
                            <p className="font-medium hover:text-primary">{d.shop_name}</p>
                            <p className="text-xs text-muted-foreground">{d.city}, {d.state}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold">{formatINR(pPrice)}</span>
                        {isCheapest && dealerVariants.length > 1 && <Badge className="ml-2 bg-success/15 text-success text-[10px]">Lowest</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('flex items-center gap-1.5', sConfig.color)}>
                          <span className={cn('h-2 w-2 rounded-full', sConfig.dot)} />
                          {p.stock_status === 'in_stock' ? `${p.stock_qty} in stock` : sConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {distance !== null ? (
                          <div>
                            <p className="font-medium">{formatDistance(distance)}</p>
                            <p className="text-xs text-muted-foreground">{estimateDriveTime(distance)} min drive</p>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" /> {d.rating.toFixed(1)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button asChild size="sm" variant="outline"><Link href={`tel:${d.phone}`}><Phone className="h-3.5 w-3.5" /></Link></Button>
                          <Button asChild size="sm" variant="outline"><Link href={`/messages?dealer=${d.id}`}><MessageCircle className="h-3.5 w-3.5" /></Link></Button>
                          {d.whatsapp && <Button asChild size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10"><Link href={`https://wa.me/91${d.whatsapp}`} target="_blank"><MessageCircle className="h-3.5 w-3.5" /></Link></Button>}
                          <Button asChild size="sm"><Link href={`https://www.google.com/maps/dir/?api=1&destination=${d.map_lat},${d.map_lng}`} target="_blank"><Navigation className="mr-1 h-3.5 w-3.5" /> Directions</Link></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* TABS: Description / Specs / Reviews */}
      <section className="mt-8">
        <Tabs defaultValue="description">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="specs">Specifications</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-4">
            <Card className="p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
              {product.features.length > 0 && (
                <>
                  <h3 className="mt-6 mb-3 text-sm font-semibold">Key Features</h3>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {product.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>
                    ))}
                  </ul>
                </>
              )}
              {product.tags.length > 0 && (
                <>
                  <h3 className="mt-6 mb-2 text-sm font-semibold">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>)}
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="specs" className="mt-4">
            <Card className="p-6">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {Object.entries(product.specifications).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border/50 py-2">
                    <dt className="text-sm capitalize text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-sm font-medium">{v}</dd>
                  </div>
                ))}
                {product.color && <div className="flex justify-between border-b border-border/50 py-2"><dt className="text-sm text-muted-foreground">Color</dt><dd className="text-sm font-medium">{product.color}</dd></div>}
                {product.size && <div className="flex justify-between border-b border-border/50 py-2"><dt className="text-sm text-muted-foreground">Size</dt><dd className="text-sm font-medium">{product.size}</dd></div>}
                {product.weight && <div className="flex justify-between border-b border-border/50 py-2"><dt className="text-sm text-muted-foreground">Weight</dt><dd className="text-sm font-medium">{product.weight}</dd></div>}
                {product.material && <div className="flex justify-between border-b border-border/50 py-2"><dt className="text-sm text-muted-foreground">Material</dt><dd className="text-sm font-medium">{product.material}</dd></div>}
                {product.warranty && <div className="flex justify-between border-b border-border/50 py-2"><dt className="text-sm text-muted-foreground">Warranty</dt><dd className="text-sm font-medium">{product.warranty}</dd></div>}
                {product.return_policy && <div className="flex justify-between border-b border-border/50 py-2"><dt className="text-sm text-muted-foreground">Return Policy</dt><dd className="text-sm font-medium">{product.return_policy}</dd></div>}
              </dl>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5 lg:col-span-1">
                <h3 className="mb-3 text-sm font-semibold">Write a Review</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="rev-name" className="text-xs">Your Name</Label>
                    <Input id="rev-name" value={reviewForm.name} onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })} placeholder="Enter your name" />
                  </div>
                  <div>
                    <Label className="text-xs">Rating</Label>
                    <div className="flex gap-1 pt-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button key={i} onClick={() => setReviewForm({ ...reviewForm, rating: i })}>
                          <Star className={cn('h-6 w-6', i <= reviewForm.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="rev-comment" className="text-xs">Comment</Label>
                    <Textarea id="rev-comment" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Share your experience..." rows={3} />
                  </div>
                  <Button onClick={submitReview} disabled={submittingReview} className="w-full">
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              </Card>

              <div className="space-y-3 lg:col-span-2">
                {reviews.length === 0 ? (
                  <Card className="flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
                    No reviews yet. Be the first to review!
                  </Card>
                ) : (
                  reviews.map((rev) => (
                    <Card key={rev.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{rev.customer_name[0]}</div>
                          <div>
                            <p className="text-sm font-medium">{rev.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{timeAgo(rev.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('h-3.5 w-3.5', i <= rev.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />)}
                        </div>
                      </div>
                      {rev.comment && <p className="mt-2 text-sm text-muted-foreground">{rev.comment}</p>}
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* SIMILAR PRODUCTS */}
      {similar.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold">{t('similarProducts')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {similar.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
