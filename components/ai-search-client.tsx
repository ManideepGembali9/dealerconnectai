'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles, Search, Camera, Mic, X, MapPin, Star, Navigation, Phone,
  MessageSquare, Loader2, Package, Store, TrendingUp, Filter, ArrowLeft,
  CheckCircle2, AlertCircle, ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ProductCard } from '@/components/product-card';
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { saveSearchHistory } from '@/lib/customer';
import { fetchProducts, fetchApprovedDealers, fetchCategories } from '@/lib/data';
import { aiSearchProducts, aiAnalyzeImage } from '@/lib/ai';
import { haversineKm, formatDistance, getPinCentroid } from '@/lib/geo';
import { formatINR, getEffectivePrice, getDiscountPercent, timeAgo } from '@/lib/format';
import type { Product, Dealer, Category } from '@/lib/supabase';
import { ProductGridSkeleton, EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const POPULAR_SEARCHES = [
  'Samsung TV',
  'iPhone 15',
  'HP Laptop',
  'LG Refrigerator',
  'Royal Enfield accessories',
];

export function AiSearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { location, setLocation } = useApp();
  const { customer } = useAuth();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<ReturnType<typeof aiAnalyzeImage> | null>(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [pinInput, setPinInput] = useState(location.pinCode ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, d, c] = await Promise.all([
          fetchProducts({ limit: 200 }),
          fetchApprovedDealers(50),
          fetchCategories(),
        ]);
        setAllProducts(p);
        setDealers(d);
        setCategories(c);
      } catch (e) {
        toast.error('Failed to load data');
      }
    })();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q && allProducts.length > 0) {
      setQuery(q);
      doSearch(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts]);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() && !imageUrl) return;
    setLoading(true);
    setHasSearched(true);

    await new Promise((r) => setTimeout(r, 400));

    let results = [...allProducts];
    if (searchQuery.trim()) {
      results = aiSearchProducts(searchQuery, results);
    }
    if (imageAnalysis) {
      if (imageAnalysis.detectedBrand) {
        results = results.filter((p) => p.brand?.name?.toLowerCase().includes(imageAnalysis.detectedBrand!.toLowerCase()));
      }
      if (imageAnalysis.detectedCategory) {
        results = results.filter((p) => p.category?.name?.toLowerCase().includes(imageAnalysis.detectedCategory!.toLowerCase()));
      }
    }

    setProducts(results);
    setLoading(false);
    if (searchQuery.trim() && customer) {
      saveSearchHistory(customer.id, searchQuery.trim(), {
        searchType: imageUrl ? 'image' : 'ai',
        pinCode: location.pinCode,
        locationLabel: location.label,
        resultsCount: results.length,
      });
    }
  }, [allProducts, imageUrl, imageAnalysis, customer, location]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const analysis = aiAnalyzeImage(file.name);
    setImageAnalysis(analysis);
    setQuery(analysis.detectedProduct !== 'Product' ? analysis.detectedProduct : '');
    toast.success(`AI detected: ${analysis.detectedProduct}${analysis.detectedBrand ? ' by ' + analysis.detectedBrand : ''}`);
  };

  const handlePinSet = () => {
    if (pinInput.length === 6) {
      const centroid = getPinCentroid(pinInput);
      setLocation({
        pinCode: pinInput,
        label: centroid?.label ?? `PIN ${pinInput}`,
        lat: centroid?.lat ?? null,
        lng: centroid?.lng ?? null,
      });
      toast.success(`Location set to ${centroid?.label ?? 'PIN ' + pinInput}`);
    }
  };

  const nearbyDealers = useMemo(() => {
    if (!location.lat || !location.lng) return [];
    return dealers
      .filter((d) => d.map_lat && d.map_lng)
      .map((d) => ({
        dealer: d,
        distance: haversineKm(location.lat!, location.lng!, d.map_lat!, d.map_lng!),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
  }, [dealers, location]);

  const productDealers = useMemo(() => {
    const dealerIds = new Set(products.map((p) => p.dealer_id).filter(Boolean));
    return nearbyDealers.filter((d) => dealerIds.has(d.dealer.id));
  }, [nearbyDealers, products]);

  const stockConfig: Record<string, { label: string; color: string; icon: any }> = {
    in_stock: { label: 'In Stock', color: 'text-success', icon: CheckCircle2 },
    limited: { label: 'Limited', color: 'text-warning', icon: AlertCircle },
    out_of_stock: { label: 'Out of Stock', color: 'text-destructive', icon: X },
    restocking: { label: 'Restocking', color: 'text-warning', icon: Package },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="rounded-lg p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl blue-gradient">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold md:text-2xl">Ask DealerConnect AI</h1>
            <p className="text-sm text-muted-foreground">Natural language search with AI-powered product discovery</p>
          </div>
        </div>
      </div>

      {/* AI Search Card */}
      <Card className="mb-6 border-border/60 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          {/* Image preview */}
          {imageUrl && (
            <div className="relative inline-block">
              <img src={imageUrl} alt="Uploaded" className="h-32 w-32 rounded-lg border object-cover" />
              <button
                onClick={() => { setImageUrl(null); setImageAnalysis(null); }}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Search input */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch(query)}
                placeholder="e.g. Samsung 55 inch TV under ₹50,000 near me"
                className="h-12 pl-10 text-sm"
              />
            </div>
            <Button
              onClick={() => doSearch(query)}
              disabled={loading || (!query.trim() && !imageUrl)}
              className="h-12 blue-gradient text-white hover:opacity-90"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? 'Searching...' : 'Ask AI'}
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageUpload} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Upload Image
            </Button>
            <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
              <Camera className="mr-1.5 h-3.5 w-3.5" /> Take Photo
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Mic className="mr-1.5 h-3.5 w-3.5" /> Voice
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Input
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSet()}
                placeholder="PIN code"
                className="h-8 w-28 text-xs"
              />
              <Button size="sm" variant="outline" onClick={handlePinSet} disabled={pinInput.length !== 6}>
                <MapPin className="mr-1 h-3.5 w-3.5" /> Set
              </Button>
            </div>
          </div>

          {/* AI image analysis result */}
          {imageAnalysis && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">AI Image Analysis</span>
                <Badge variant="secondary" className="ml-auto">{(imageAnalysis.confidence * 100).toFixed(0)}% confidence</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                {imageAnalysis.detectedProduct !== 'Product' && <div><span className="text-muted-foreground">Product:</span> {imageAnalysis.detectedProduct}</div>}
                {imageAnalysis.detectedBrand && <div><span className="text-muted-foreground">Brand:</span> {imageAnalysis.detectedBrand}</div>}
                {imageAnalysis.detectedCategory && <div><span className="text-muted-foreground">Category:</span> {imageAnalysis.detectedCategory}</div>}
                {imageAnalysis.detectedColor && <div><span className="text-muted-foreground">Color:</span> {imageAnalysis.detectedColor}</div>}
              </div>
            </div>
          )}

          {/* Popular searches */}
          {!hasSearched && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Popular searches:</p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); doSearch(s); }}
                    className="rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : hasSearched && products.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching products found"
          description="Try rephrasing your search or using different keywords. You can also upload a product image for AI-powered detection."
        />
      ) : products.length > 0 ? (
        <div className="space-y-6">
          {/* AI summary */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">AI Search Results</p>
                <p className="mt-1 text-muted-foreground">
                  Found <strong>{products.length}</strong> matching product{products.length > 1 ? 's' : ''}
                  {location.label && <> near <strong>{location.label}</strong></>}
                  {productDealers.length > 0 && <> at <strong>{productDealers.length}</strong> nearby dealer{productDealers.length > 1 ? 's' : ''}</>}
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Product results */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Package className="h-5 w-5" /> Matching Products
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.slice(0, 12).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>

          {/* Nearby dealers with availability */}
          {nearbyDealers.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Store className="h-5 w-5" /> Nearby Dealers
                {location.label && <span className="text-sm font-normal text-muted-foreground">near {location.label}</span>}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nearbyDealers.map(({ dealer, distance }) => {
                  const dealerProducts = products.filter((p) => p.dealer_id === dealer.id);
                  const hasStock = dealerProducts.some((p) => p.stock_status === 'in_stock');
                  return (
                    <Card key={dealer.id} className="border-border/60 p-4 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {dealer.logo_url ? (
                            <Image src={dealer.logo_url} alt={dealer.shop_name} width={48} height={48} className="rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                              <Store className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <Link href={`/dealer/${dealer.id}`} className="font-semibold hover:text-primary">
                              {dealer.shop_name}
                            </Link>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              {dealer.rating.toFixed(1)} · {dealer.product_count} products
                            </div>
                          </div>
                        </div>
                        <Badge variant={hasStock ? 'default' : 'secondary'} className={hasStock ? 'bg-success text-success-foreground' : ''}>
                          {hasStock ? 'Available' : 'Check stock'}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {dealer.city}, {dealer.state} · {formatDistance(distance)} away
                      </div>

                      {/* Price comparison */}
                      {dealerProducts.length > 0 && (
                        <div className="mt-2 text-xs">
                          <span className="text-muted-foreground">Starting from </span>
                          <span className="font-semibold text-primary">
                            {formatINR(Math.min(...dealerProducts.map((p) => getEffectivePrice(p.price, p.discount_price))))}
                          </span>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${dealer.map_lat},${dealer.map_lng}`} target="_blank" rel="noopener noreferrer">
                            <Navigation className="mr-1 h-3.5 w-3.5" /> Directions
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={`tel:${dealer.phone}`}>
                            <Phone className="mr-1 h-3.5 w-3.5" /> Call
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/messages?dealer=${dealer.id}`}>
                            <MessageSquare className="mr-1 h-3.5 w-3.5" /> Chat
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dealer/${dealer.id}`}>
                            View Products
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Initial state - categories */}
      {!hasSearched && !loading && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5" /> Browse by Category
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/search?category=${cat.slug}`}
                className="rounded-lg border border-border/60 p-4 text-center transition-all hover:border-primary hover:shadow-md"
              >
                <p className="font-medium">{cat.name}</p>
                {cat.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{cat.description}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
