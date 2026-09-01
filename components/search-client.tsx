'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, MapPin, SlidersHorizontal, X, Check, Mic, Camera, Sparkles, Navigation, History, TrendingUp, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from '@/components/product-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { saveSearchHistory } from '@/lib/customer';
import { fetchCategories, fetchProducts, fetchDealersByPin } from '@/lib/data';
import { getEffectivePrice } from '@/lib/format';
import { haversineKm, getPinCentroid } from '@/lib/geo';
import { aiSearchProducts } from '@/lib/ai';
import type { Category, Product, Dealer } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SortKey = 'relevance' | 'price_low' | 'price_high' | 'nearest' | 'rating' | 'offers';

const POPULAR_SEARCHES = ['Samsung TV', 'iPhone 15', 'HP Laptop', 'LG Refrigerator', 'Royal Enfield accessories'];
const RECENT_SEARCHES_KEY = 'dc-recent-searches';

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]'); } catch { return []; }
}
function addRecentSearch(q: string) {
  try {
    const prev = getRecentSearches().filter((s) => s !== q);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([q, ...prev].slice(0, 8)));
  } catch {}
}

export function SearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { location, setLocation, t } = useApp();
  const { customer } = useAuth();
  const initialQ = searchParams.get('q') ?? '';
  const initialPin = searchParams.get('pin') ?? location.pinCode ?? '';
  const initialCategory = searchParams.get('category') ?? '';
  const initialSort = (searchParams.get('sort') as SortKey) ?? 'relevance';
  const initialFilter = searchParams.get('filter') ?? '';

  const [query, setQuery] = useState(initialQ);
  const [pin, setPin] = useState(initialPin);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [stockOnly, setStockOnly] = useState(initialFilter === 'instock');
  const [offersOnly, setOffersOnly] = useState(initialFilter === 'offers');
  const [trendingOnly, setTrendingOnly] = useState(initialFilter === 'trending' || (initialSort as string) === 'trending');
  const [openNow, setOpenNow] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [pickupOnly, setPickupOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(150000);
  const [minRating, setMinRating] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cats, prods] = await Promise.all([fetchCategories(), fetchProducts({ limit: 200 })]);
        setCategories(cats);
        setAllProducts(prods);
        if (initialPin) {
          const dls = await fetchDealersByPin(initialPin);
          setDealers(dls);
          const c = getPinCentroid(initialPin);
          setLocation({ pinCode: initialPin, label: c?.label ?? initialPin, lat: c?.lat ?? null, lng: c?.lng ?? null });
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load search results');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dealerMap = useMemo(() => new Map(dealers.map((d) => [d.id, d])), [dealers]);

  const filtered = useMemo(() => {
    let results = [...allProducts];

    // PIN code filter - if pin set, prioritize products from dealers in that pin
    const pinDealers = pin ? dealers : [];
    const pinDealerIds = new Set(pinDealers.map((d) => d.id));

    // Category filter
    if (selectedCategory) {
      const cat = categories.find((c) => c.slug === selectedCategory);
      if (cat) results = results.filter((p) => p.category_id === cat.id);
    }

    // Search query - use AI search
    if (query.trim()) {
      results = aiSearchProducts(query, results);
    }

    // Stock filter
    if (stockOnly) results = results.filter((p) => p.stock_status === 'in_stock');

    // Offers filter
    if (offersOnly) results = results.filter((p) => p.discount_price && p.discount_price > 0);

    // Trending filter
    if (trendingOnly) results = results.filter((p) => p.is_trending);

    // Price filter
    results = results.filter((p) => getEffectivePrice(p.price, p.discount_price) <= maxPrice);

    // Rating filter
    if (minRating > 0) results = results.filter((p) => (p.dealer?.rating ?? 0) >= minRating);

    // Delivery / pickup / open now / verified
    if (deliveryOnly) results = results.filter((p) => p.delivery_available || p.dealer?.delivery_available);
    if (pickupOnly) results = results.filter((p) => p.pickup_available || p.dealer?.pickup_available);
    if (verifiedOnly) results = results.filter((p) => p.ai_verified);

    // Compute distance for sorting
    const withDistance = results.map((p) => {
      const d = p.dealer;
      const distance = d && d.map_lat && d.map_lng && location.lat && location.lng
        ? haversineKm(location.lat, location.lng, d.map_lat, d.map_lng)
        : null;
      return { product: p, distance };
    });

    // Sort
    switch (sort) {
      case 'price_low':
        withDistance.sort((a, b) => getEffectivePrice(a.product.price, a.product.discount_price) - getEffectivePrice(b.product.price, b.product.discount_price));
        break;
      case 'price_high':
        withDistance.sort((a, b) => getEffectivePrice(b.product.price, b.product.discount_price) - getEffectivePrice(a.product.price, a.product.discount_price));
        break;
      case 'nearest':
        withDistance.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
        break;
      case 'rating':
        withDistance.sort((a, b) => (b.product.dealer?.rating ?? 0) - (a.product.dealer?.rating ?? 0));
        break;
      case 'offers':
        withDistance.sort((a, b) => {
          const da = a.product.discount_price ? (a.product.price - a.product.discount_price) / a.product.price : 0;
          const db = b.product.discount_price ? (b.product.price - b.product.discount_price) / b.product.price : 0;
          return db - da;
        });
        break;
      default:
        // relevance: AI search already sorted; if no query, sort by view_count
        if (!query.trim()) withDistance.sort((a, b) => b.product.view_count - a.product.view_count);
    }

    // If PIN set, boost products from that pin's dealers to the top
    if (pin && pinDealerIds.size > 0) {
      withDistance.sort((a, b) => {
        const aIn = a.product.dealer_id && pinDealerIds.has(a.product.dealer_id) ? 0 : 1;
        const bIn = b.product.dealer_id && pinDealerIds.has(b.product.dealer_id) ? 0 : 1;
        return aIn - bIn;
      });
    }

    return withDistance;
  }, [allProducts, query, selectedCategory, stockOnly, offersOnly, trendingOnly, maxPrice, minRating, deliveryOnly, pickupOnly, verifiedOnly, sort, pin, dealers, categories, location]);

  const updateUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/search?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { addRecentSearch(query.trim()); setRecentSearches(getRecentSearches()); }
    updateUrl({ q: query.trim() || undefined, pin: pin || undefined });
    if (query.trim() && customer) {
      saveSearchHistory(customer.id, query.trim(), {
        searchType: 'text',
        pinCode: pin || null,
        locationLabel: location.label,
        resultsCount: filtered.length,
      });
    }
  };

  const handlePin = (value: string) => {
    setPin(value);
    if (value.length === 6) {
      const c = getPinCentroid(value);
      setLocation({ pinCode: value, label: c?.label ?? value, lat: c?.lat ?? null, lng: c?.lng ?? null });
      updateUrl({ pin: value });
    }
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setStockOnly(false);
    setOffersOnly(false);
    setTrendingOnly(false);
    setOpenNow(false);
    setDeliveryOnly(false);
    setPickupOnly(false);
    setVerifiedOnly(false);
    setMaxPrice(150000);
    setMinRating(0);
    updateUrl({ category: undefined, filter: undefined, sort: undefined });
  };

  const activeFilterCount = [selectedCategory, stockOnly, offersOnly, trendingOnly, openNow, deliveryOnly, pickupOnly, verifiedOnly, minRating > 0].filter(Boolean).length;

  const FilterPanel = () => (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Category</h3>
        <div className="space-y-1.5">
          <button onClick={() => { setSelectedCategory(''); updateUrl({ category: undefined }); }} className={cn('block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', !selectedCategory && 'bg-accent/10 font-medium text-primary')}>All Categories</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => { setSelectedCategory(c.slug); updateUrl({ category: c.slug }); }} className={cn('block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', selectedCategory === c.slug && 'bg-accent/10 font-medium text-primary')}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Price Range</h3>
        <div className="px-2">
          <Slider value={[maxPrice]} onValueChange={([v]) => setMaxPrice(v)} max={150000} step={1000} className="my-3" />
          <p className="text-xs text-muted-foreground">Up to ₹{maxPrice.toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Minimum Rating</h3>
        <div className="space-y-1.5">
          {[0, 3, 4, 4.5].map((r) => (
            <button key={r} onClick={() => setMinRating(r)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', minRating === r && 'bg-accent/10 font-medium text-primary')}>
              {r === 0 ? 'Any rating' : `${r}+ stars`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Availability</h3>
        <div className="space-y-2">
          <FilterCheckbox checked={stockOnly} onChange={setStockOnly} label="In Stock Only" />
          <FilterCheckbox checked={openNow} onChange={setOpenNow} label="Open Now" />
          <FilterCheckbox checked={deliveryOnly} onChange={setDeliveryOnly} label="Home Delivery" />
          <FilterCheckbox checked={pickupOnly} onChange={setPickupOnly} label="Pickup Available" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Special</h3>
        <div className="space-y-2">
          <FilterCheckbox checked={offersOnly} onChange={setOffersOnly} label="On Offer / Discount" />
          <FilterCheckbox checked={trendingOnly} onChange={setTrendingOnly} label="Trending" />
          <FilterCheckbox checked={verifiedOnly} onChange={setVerifiedOnly} label="AI Verified" />
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={clearFilters}>
        <X className="mr-1 h-4 w-4" /> Clear all filters
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} className="h-11 pl-9 pr-20" />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8"><Mic className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8"><Camera className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="relative sm:w-36">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={pin} onChange={(e) => handlePin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN code" className="h-11 pl-9" inputMode="numeric" />
        </div>
        <Button type="submit" className="h-11"><Search className="mr-1 h-4 w-4" /> Search</Button>
      </form>

      {/* AI badge if query */}
      {query.trim() && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-muted-foreground">AI understood your query and found <span className="font-semibold text-foreground">{filtered.length} matching products</span>{pin && ` near PIN ${pin}`}</span>
        </div>
      )}

      {/* Popular & recent searches (when no query) */}
      {!query.trim() && !loading && (
        <div className="mb-4 space-y-3">
          {recentSearches.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><History className="h-3 w-3" /> Recent Searches</span>
                <button onClick={() => { localStorage.removeItem(RECENT_SEARCHES_KEY); setRecentSearches([]); }} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((s) => (
                  <button key={s} onClick={() => { setQuery(s); updateUrl({ q: s }); }} className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
                    <History className="h-3 w-3" /> {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><TrendingUp className="h-3 w-3" /> Popular Searches</span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SEARCHES.map((s) => (
                <button key={s} onClick={() => { setQuery(s); addRecentSearch(s); setRecentSearches(getRecentSearches()); updateUrl({ q: s }); }} className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* Category suggestions */}
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Categories</span>
            <div className="flex flex-wrap gap-1.5">
              {categories.slice(0, 8).map((c) => (
                <button key={c.id} onClick={() => { setSelectedCategory(c.slug); updateUrl({ category: c.slug }); }} className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Desktop filters sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold"><SlidersHorizontal className="h-4 w-4" /> {t('filters')}</h2>
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </div>
            <FilterPanel />
          </Card>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">
                {loading ? 'Searching...' : `${filtered.length} ${t('resultsFound')}`}
              </h1>
              {location.label && <Badge variant="secondary" className="gap-1"><MapPin className="h-3 w-3" /> {location.label}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile filter button */}
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="mr-1 h-4 w-4" /> Filters
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{activeFilterCount}</Badge>}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-xs overflow-y-auto p-0">
                  <SheetHeader className="px-4 pt-4">
                    <SheetTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> {t('filters')}</SheetTitle>
                  </SheetHeader>
                  <div className="p-4"><FilterPanel /></div>
                </SheetContent>
              </Sheet>
              <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); updateUrl({ sort: v }); }}>
                <SelectTrigger className="h-9 w-40 text-sm">
                  <SelectValue placeholder={t('sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="price_low">Lowest Price</SelectItem>
                  <SelectItem value="price_high">Highest Price</SelectItem>
                  <SelectItem value="nearest">Nearest Shop</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="offers">Best Offers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="aspect-square animate-pulse bg-muted" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground" />
              <p className="text-base font-medium">{t('noResults')}</p>
              <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map(({ product, distance }) => (
                <ProductCard key={product.id} product={product} distanceKm={distance ?? undefined} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={label} checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <Label htmlFor={label} className="cursor-pointer text-sm">{label}</Label>
    </div>
  );
}
