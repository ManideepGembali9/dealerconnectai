'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search, MapPin, Mic, Camera, Sparkles, TrendingUp, Star, Zap, ChevronRight,
  Navigation, Clock, Tag, Store, ShoppingBag, Pill, Smartphone, Shirt, Footprints,
  Car, Utensils, Cake, Gift, Wrench, BookOpen, Baby, Dumbbell, Watch, Glasses,
  Flower2, Sprout, Palette, Gem, Circle, ShoppingCart, Apple, Refrigerator, Scale,
  X, MessageSquare, Phone, BadgeCheck, History,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from '@/components/product-card';
import { useApp } from '@/lib/providers';
import { fetchCategories, fetchApprovedDealers, fetchProducts, fetchProductById } from '@/lib/data';
import { formatINR, getEffectivePrice, formatCompact } from '@/lib/format';
import { haversineKm, formatDistance, getPinCentroid } from '@/lib/geo';
import { aiSearchProducts } from '@/lib/ai';
import type { Category, Dealer, Product } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const RECENT_SEARCHES_KEY = 'dc-recent-searches';
const POPULAR_SEARCHES = ['Samsung TV', 'iPhone 15', 'HP Laptop', 'LG Refrigerator', 'Royal Enfield accessories'];

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]'); } catch { return []; }
}
function addRecentSearch(q: string) {
  try {
    const prev = getRecentSearches().filter((s) => s !== q);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([q, ...prev].slice(0, 8)));
  } catch {}
}
function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch {}
}

const ICON_MAP: Record<string, LucideIcon> = {
  Smartphone, ShoppingCart, Refrigerator, Apple, Shirt, Footprints, Gem, Circle,
  Sparkles, Pill, Wrench, Car, Dumbbell, BookOpen, Baby, Gift, Flower2, Sprout,
  Utensils, Cake, Watch, Glasses, Palette, Tag, Store, MapPin, Clock,
};

export function HomeClient() {
  const { t, location, setLocation, recentlyViewed, savedDealers, toggleSavedDealer } = useApp();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Product[]>([]);
  const [latest, setLatest] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [pin, setPin] = useState(location.pinCode ?? '');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    (async () => {
      try {
        const [cats, dls, trnd, feat, all] = await Promise.all([
          fetchCategories(),
          fetchApprovedDealers(8),
          fetchProducts({ trending: true, limit: 12 }),
          fetchProducts({ featured: true, limit: 12 }),
          fetchProducts({ limit: 24 }),
        ]);
        setCategories(cats);
        setDealers(dls);
        setTrending(trnd);
        setFeatured(feat);
        setOffers(all.filter((p) => p.discount_price && p.discount_price > 0).slice(0, 8));
        setLatest(all.slice(0, 12));
        if (recentlyViewed.length > 0) {
          const recent = await Promise.all(recentlyViewed.slice(0, 6).map((id) => fetchProductById(id)));
          setRecentProducts(recent.filter(Boolean) as Product[]);
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [recentlyViewed]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) addRecentSearch(query.trim());
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (pin.trim()) params.set('pin', pin.trim());
    router.push(`/search?${params.toString()}`);
  };

  const handleAiSearch = () => {
    if (query.trim()) addRecentSearch(query.trim());
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (pin.trim()) params.set('pin', pin.trim());
    router.push(`/ai-search?${params.toString()}`);
  };

  const handlePin = (value: string) => {
    setPin(value);
    if (value.length === 6) {
      const c = getPinCentroid(value);
      setLocation({ pinCode: value, label: c?.label ?? value, lat: c?.lat ?? null, lng: c?.lng ?? null });
    }
  };

  const useLiveLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ pinCode: null, label: 'Live location', lat: pos.coords.latitude, lng: pos.coords.longitude });
          toast.success('Using your live location');
        },
        () => {
          setLocation({ pinCode: '532440', label: 'Amalapuram, AP', lat: 16.9034, lng: 82.0175 });
          setPin('532440');
          toast.info('Using demo location (Amalapuram, 532440)');
        }
      );
    }
  };

  const userLat = location.lat ?? 16.9034;
  const userLng = location.lng ?? 82.0175;

  const nearbyDealers = [...dealers]
    .map((d) => ({
      dealer: d,
      distance: d.map_lat && d.map_lng ? haversineKm(userLat, userLng, d.map_lat, d.map_lng) : null,
    }))
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
    .slice(0, 6);

  const aiRecs = aiSearchProducts('trending featured popular', [...featured, ...trending, ...latest]).slice(0, 4);

  return (
    <div className="flex flex-col">
      {/* PERSONALIZED WELCOME + AI SEARCH */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 gap-1.5 bg-primary/10 text-primary hover:bg-primary/15">
              <Sparkles className="h-3.5 w-3.5" /> AI-Powered Local Marketplace
            </Badge>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Find what you need.
              <span className="block blue-gradient-text">
                Near you.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              Search products, discover trusted local dealers, compare prices, check availability, and connect instantly with AI-powered local shopping.
            </p>

            {/* AI Search bar */}
            <form onSubmit={handleSearch} className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row" ref={searchRef}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Try 'Samsung S25', 'Paracetamol', 'Nike shoes'..."
                  className="h-12 pl-12 pr-24 text-base shadow-sm"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" title="Voice search"><Mic className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" title="Image search" onClick={() => router.push('/ai-search')}><Camera className="h-4 w-4" /></Button>
                </div>

                {/* Search suggestions dropdown */}
                {showSuggestions && (recentSearches.length > 0 || POPULAR_SEARCHES.length > 0) && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-2 rounded-xl border border-border/60 bg-popover p-3 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                    {recentSearches.length > 0 && (
                      <div className="mb-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><History className="h-3 w-3" /> Recent Searches</span>
                          <button onClick={() => { clearRecentSearches(); setRecentSearches([]); }} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {recentSearches.map((s) => (
                            <button key={s} onClick={() => { setQuery(s); setShowSuggestions(false); }} className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
                              <Clock className="h-3 w-3" /> {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="mb-2 block text-xs font-semibold text-muted-foreground">Popular Searches</span>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_SEARCHES.map((s) => (
                          <button key={s} onClick={() => { setQuery(s); setShowSuggestions(false); }} className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="relative sm:w-40">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={pin}
                  onChange={(e) => handlePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN code"
                  className="h-12 pl-12 text-base shadow-sm"
                  inputMode="numeric"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-6 shadow-sm">
                <Search className="mr-1.5 h-5 w-5" /> Search
              </Button>
            </form>

            {/* AI Search button */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handleAiSearch}
                className="flex items-center gap-2 rounded-full blue-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:scale-105 active:scale-95"
              >
                <Sparkles className="h-4 w-4" /> Ask DealerConnect AI
              </button>
              <Link
                href="/dealer/register"
                className="flex items-center gap-2 rounded-full border border-primary/30 bg-background/80 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                <Store className="h-4 w-4" /> Become a Dealer
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
              <Button variant="outline" size="sm" onClick={useLiveLocation}>
                <Navigation className="mr-1.5 h-4 w-4" /> Use my location
              </Button>
              <span className="text-muted-foreground">or try PIN:</span>
              {['532440', '533001'].map((p) => (
                <button key={p} onClick={() => handlePin(p)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">
                  {p}
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-2 text-left sm:grid-cols-3 sm:gap-3">
              <Link href="/search" className="rounded-xl border border-border/60 bg-background/70 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <Search className="mb-2 h-4 w-4 text-primary" />
                <span className="block text-sm font-semibold">Search anything</span>
                <span className="text-xs text-muted-foreground">Text, voice, or image</span>
              </Link>
              <Link href="/nearby" className="rounded-xl border border-border/60 bg-background/70 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <MapPin className="mb-2 h-4 w-4 text-primary" />
                <span className="block text-sm font-semibold">Discover nearby</span>
                <span className="text-xs text-muted-foreground">Find shops with stock</span>
              </Link>
              <Link href="/compare" className="rounded-xl border border-border/60 bg-background/70 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <Scale className="mb-2 h-4 w-4 text-primary" />
                <span className="block text-sm font-semibold">Compare with confidence</span>
                <span className="text-xs text-muted-foreground">Prices, ratings, and distance</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        {/* POPULAR CATEGORIES */}
        <Section
          title={t('popularCategories')}
          icon={Tag}
          action={<Link href="/categories" className="text-sm font-medium text-primary hover:underline">{t('viewAll')} →</Link>}
        >
          {loading ? (
            <CategorySkeleton />
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {categories.slice(0, 16).map((cat) => {
                const Icon = ICON_MAP[cat.icon] ?? Tag;
                return (
                  <Link
                    key={cat.id}
                    href={`/search?category=${cat.slug}`}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-center transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10 text-primary transition-colors group-hover:from-primary group-hover:to-accent group-hover:text-primary-foreground">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="line-clamp-2 text-xs font-medium leading-tight">{cat.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>

        {/* AI RECOMMENDATIONS */}
        <Section title={t('aiRecommendations')} icon={Sparkles} badge={<Badge className="bg-accent/10 text-accent"><Sparkles className="mr-1 h-3 w-3" /> AI</Badge>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {aiRecs.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </Section>

        {/* RECENTLY VIEWED */}
        {recentProducts.length > 0 && (
          <Section title="Recently Viewed" icon={Clock} action={<Link href="/profile" className="text-sm font-medium text-primary hover:underline">View all →</Link>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {recentProducts.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </Section>
        )}

        {/* TRENDING */}
        <Section
          title={t('trending')}
          icon={TrendingUp}
          badge={<Badge className="bg-warning/10 text-warning"><Zap className="mr-1 h-3 w-3" /> Hot</Badge>}
          action={<Link href="/search?sort=trending" className="text-sm font-medium text-primary hover:underline">{t('viewAll')} →</Link>}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {trending.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </Section>

        {/* TODAY'S OFFERS */}
        {offers.length > 0 && (
          <Section title={t('offers')} icon={Tag} badge={<Badge className="bg-destructive/10 text-destructive">Save up to 30%</Badge>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {offers.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </Section>
        )}

        {/* NEARBY SHOPS */}
        <Section
          title={t('nearbyShops')}
          icon={MapPin}
          badge={location.label && <Badge variant="secondary">{location.label}</Badge>}
          action={<Link href="/nearby" className="text-sm font-medium text-primary hover:underline">{t('viewAll')} →</Link>}
        >
          {nearbyDealers.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Enter your PIN code to discover nearby shops</p>
              <div className="flex gap-2">
                <Input placeholder="PIN code" value={pin} onChange={(e) => handlePin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-32" inputMode="numeric" />
                <Button onClick={useLiveLocation}><Navigation className="mr-1 h-4 w-4" /> Location</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {nearbyDealers.map(({ dealer, distance }) => {
                const isSaved = savedDealers.includes(dealer.id);
                return (
                <Card key={dealer.id} className="group flex flex-col gap-3 overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-lg">
                  <Link href={`/dealer/${dealer.id}`} className="flex gap-3">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-muted">
                      <Image src={dealer.logo_url ?? 'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=200'} alt={dealer.shop_name} fill sizes="96px" className="object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-sm font-semibold">{dealer.shop_name}</h3>
                        {dealer.status === 'approved' && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{dealer.category?.name ?? 'General'} · {dealer.city}</p>
                      <div className="mt-auto flex items-center gap-2 pt-1.5 text-xs">
                        <span className="flex items-center gap-0.5 font-medium"><Star className="h-3 w-3 fill-warning text-warning" /> {dealer.rating.toFixed(1)}</span>
                        {distance !== null && (
                          <span className="flex items-center gap-0.5 font-medium text-primary"><MapPin className="h-3 w-3" /> {formatDistance(distance)}</span>
                        )}
                        <span className="flex items-center gap-0.5 text-muted-foreground"><ShoppingBag className="h-3 w-3" /> {dealer.product_count}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 border-t border-border/60 px-3 py-2">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" asChild>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${dealer.map_lat},${dealer.map_lng}`} target="_blank" rel="noopener noreferrer">
                        <Navigation className="mr-1 h-3 w-3" /> Directions
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" asChild>
                      <a href={`tel:${dealer.phone}`}><Phone className="mr-1 h-3 w-3" /> Call</a>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" asChild>
                      <Link href={`/messages?dealer=${dealer.id}`}><MessageSquare className="mr-1 h-3 w-3" /> Chat</Link>
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { toggleSavedDealer(dealer.id); toast.success(isSaved ? 'Removed from saved' : 'Dealer saved'); }}>
                      <Store className={cn('h-3.5 w-3.5', isSaved ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                    </Button>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </Section>

        {/* FEATURED DEALERS */}
        <Section title={t('featuredDealers')} icon={Store} action={<Link href="/nearby" className="text-sm font-medium text-primary hover:underline">{t('viewAll')} →</Link>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dealers.slice(0, 4).map((dealer) => (
              <Link key={dealer.id} href={`/dealer/${dealer.id}`}>
                <Card className="group overflow-hidden p-0 transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative h-28 overflow-hidden bg-muted">
                    <Image src={dealer.banner_url ?? dealer.logo_url ?? 'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=400'} alt={dealer.shop_name} fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-3">
                    <div className="-mt-8 mb-2 flex items-end gap-2">
                      <div className="relative h-12 w-12 overflow-hidden rounded-lg border-2 border-background bg-background">
                        <Image src={dealer.logo_url ?? 'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=100'} alt={dealer.shop_name} fill sizes="48px" className="object-cover" />
                      </div>
                    </div>
                    <h3 className="line-clamp-1 text-sm font-semibold">{dealer.shop_name}</h3>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{dealer.category?.name} · {dealer.city}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-warning text-warning" /> {dealer.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{dealer.product_count} products</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Section>

        {/* LATEST PRODUCTS */}
        <Section title={t('latestProducts')} icon={ShoppingBag} action={<Link href="/search" className="text-sm font-medium text-primary hover:underline">{t('viewAll')} →</Link>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {latest.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </Section>

        {/* FEATURE STRIP */}
        <section className="my-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: 'AI Smart Search', desc: 'Search by text, voice, or image. AI understands natural language queries.' },
            { icon: MapPin, title: 'Nearby Discovery', desc: 'Find shops by PIN code or live location with distance and directions.' },
            { icon: Scale, title: 'Compare & Save', desc: 'Compare prices across dealers and get the best deal near you.' },
          ].map((f) => (
            <Card key={f.title} className="flex items-start gap-3 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, badge, action, children }: { title: string; icon: any; badge?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CategorySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-border/60 p-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
