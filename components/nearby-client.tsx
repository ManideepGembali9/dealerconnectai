'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Navigation, Search, Star, Phone, MessageCircle, ShoppingBag, Navigation2, Store, Clock, ChevronRight, Loader2, LocateFixed, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/lib/providers';
import { fetchDealersByPin, fetchCategories, fetchApprovedDealers } from '@/lib/data';
import { haversineKm, formatDistance, estimateDriveTime, getPinCentroid, getAllPinCentroids } from '@/lib/geo';
import type { Dealer, Category } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SortKey = 'nearest' | 'rating' | 'products';

function isShopOpen(workingHours: Record<string, string>): boolean {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const hours = workingHours[day];
  if (!hours || hours === 'closed') return false;
  if (hours === '24hours') return true;
  const m = hours.match(/(\d+):(\d+)-(\d+):(\d+)/);
  if (!m) return false;
  const [, sh, sm, eh, em] = m.map(Number);
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return currentMin >= startMin && currentMin <= endMin;
}

export function NearbyClient() {
  const { location, setLocation, t } = useApp();
  const [pin, setPin] = useState(location.pinCode ?? '532440');
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('nearest');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadDealers = useCallback(async (pinCode: string) => {
    setLoading(true);
    setError(null);
    try {
      let dls = await fetchDealersByPin(pinCode);
      if (dls.length === 0) {
        dls = await fetchApprovedDealers(50);
        if (dls.length > 0) {
          toast.info(`No dealers found for PIN ${pinCode}. Showing all nearby shops instead.`);
        }
      }
      setDealers(dls);
      const c = getPinCentroid(pinCode);
      setLocation({ pinCode, label: c?.label ?? pinCode, lat: c?.lat ?? null, lng: c?.lng ?? null });
    } catch (e) {
      console.error('Failed to load dealers:', e);
      setError('Unable to load nearby shops. Please try again.');
      toast.error('Failed to load dealers');
      setDealers([]);
    } finally {
      setLoading(false);
    }
  }, [setLocation]);

  useEffect(() => {
    (async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (e) {
        console.error('Failed to load categories:', e);
      }
      await loadDealers(pin || '532440');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePin = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    setPin(clean);
    if (clean.length === 6) loadDealers(clean);
  };

  const useLiveLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    toast.loading('Detecting your location...', { id: 'geo' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.success('Location detected!', { id: 'geo' });
        setLocation({ pinCode: null, label: 'Live location', lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPin('532440');
        loadDealers('532440');
      },
      () => {
        toast.info('Using demo location — PIN 532440', { id: 'geo' });
        loadDealers('532440');
      },
      { timeout: 10000 }
    );
  };

  const userLat = location.lat ?? 16.9034;
  const userLng = location.lng ?? 82.0175;

  const filteredDealers = useMemo(() => {
    let result = dealers.map((d) => ({
      dealer: d,
      distance: d.map_lat && d.map_lng ? haversineKm(userLat, userLng, d.map_lat, d.map_lng) : 0,
      isOpen: isShopOpen(d.working_hours || {}),
    }));
    if (selectedCat && selectedCat !== 'all') {
      const cat = categories.find((c) => c.slug === selectedCat);
      if (cat) result = result.filter((r) => r.dealer.business_category_id === cat.id);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.dealer.shop_name.toLowerCase().includes(q) ||
        r.dealer.city.toLowerCase().includes(q) ||
        r.dealer.category?.name?.toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case 'rating': result.sort((a, b) => b.dealer.rating - a.dealer.rating); break;
      case 'products': result.sort((a, b) => b.dealer.product_count - a.dealer.product_count); break;
      default: result.sort((a, b) => a.distance - b.distance);
    }
    return result;
  }, [dealers, sort, selectedCat, categories, userLat, userLng, searchQuery]);

  const samplePins = Object.entries(getAllPinCentroids()).slice(0, 6);
  const openCount = filteredDealers.filter((d) => d.isOpen).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Hero search */}
      <Card className="mb-6 overflow-hidden border-0 shadow-lg">
        <div className="relative bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground sm:p-8">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
          <div className="relative">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <MapPin className="h-3 w-3" /> Nearby Discovery
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Discover Shops Near You</h1>
            <p className="mt-1.5 max-w-lg text-sm text-primary-foreground/80">
              Enter your PIN code or use live location to find verified local dealers with real-time stock and prices.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                <Input
                  value={pin}
                  onChange={(e) => handlePin(e.target.value)}
                  placeholder="Enter 6-digit PIN code"
                  className="h-12 border-0 bg-background pl-11 text-base text-foreground shadow-sm"
                  inputMode="numeric"
                />
                {pin.length === 6 && (
                  <button
                    onClick={() => { setPin(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="secondary" size="lg" className="h-12 shrink-0 font-semibold shadow-sm" onClick={useLiveLocation}>
                <LocateFixed className="mr-2 h-5 w-5" /> Use my location
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-medium text-primary-foreground/70">Popular areas:</span>
              {samplePins.map(([code, c]) => (
                <button
                  key={code}
                  onClick={() => handlePin(code)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium backdrop-blur transition-colors',
                    pin === code ? 'bg-white text-primary' : 'bg-white/15 hover:bg-white/25'
                  )}
                >
                  {code} · {c.label.split(',')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">
            {loading ? 'Loading...' : `${filteredDealers.length} shops`}
          </h2>
          {!loading && filteredDealers.length > 0 && (
            <span className="text-sm text-muted-foreground">near {location.label ?? pin}</span>
          )}
        </div>
        {!loading && openCount > 0 && (
          <Badge className="bg-success/15 text-success border-success/30">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />
            {openCount} open now
          </Badge>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter shops..."
              className="h-9 w-36 pl-8 text-sm sm:w-44"
            />
          </div>
          <Select value={selectedCat} onValueChange={setSelectedCat}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">Nearest</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="products">Most Products</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <X className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => loadDealers(pin)}>Retry</Button>
          </div>
        </Card>
      )}

      {/* Map + list */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Map */}
        <Card className="relative h-56 overflow-hidden lg:col-span-1 lg:h-auto lg:sticky lg:top-24 lg:min-h-[400px]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            {/* Decorative roads */}
            <div className="absolute left-0 top-1/3 h-px w-full bg-border/40" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-border/40" />
            <div className="absolute left-1/4 top-0 h-full w-32 rotate-12 bg-border/20" />
          </div>
          {/* User pin */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex h-6 w-6 items-center justify-center">
              <div className="absolute h-6 w-6 animate-ping rounded-full bg-primary/30" />
              <div className="h-3.5 w-3.5 rounded-full border-2 border-background bg-primary shadow-md" />
            </div>
            <p className="mt-1.5 whitespace-nowrap text-center text-xs font-semibold">You are here</p>
          </div>
          {/* Dealer pins */}
          {filteredDealers.slice(0, 6).map((d, i) => {
            const angle = (i / 6) * 2 * Math.PI;
            const radius = 70 + i * 10;
            const x = 50 + (Math.cos(angle) * radius) / 3;
            const y = 50 + (Math.sin(angle) * radius) / 4;
            return (
              <div key={d.dealer.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                <Link href={`/dealer/${d.dealer.id}`}>
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 border-background shadow-md transition-transform hover:scale-110',
                    d.isOpen ? 'bg-success text-success-foreground' : 'bg-accent text-accent-foreground'
                  )}>
                    <Store className="h-4 w-4" />
                  </div>
                </Link>
              </div>
            );
          })}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {filteredDealers.length} shops on map
          </div>
        </Card>

        {/* Dealer list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="flex gap-4 p-4">
                  <div className="h-24 w-24 shrink-0 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="flex gap-2">
                      <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                      <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredDealers.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Store className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold">No shops found{searchQuery ? ` for "${searchQuery}"` : ` for PIN ${pin}`}</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different PIN code, clear filters, or check nearby areas</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {searchQuery && (
                  <Button size="sm" variant="outline" onClick={() => setSearchQuery('')}>Clear search</Button>
                )}
                {selectedCat && selectedCat !== 'all' && (
                  <Button size="sm" variant="outline" onClick={() => setSelectedCat('')}>Clear category</Button>
                )}
                <Button size="sm" onClick={() => loadDealers('532440')}>Reset to default</Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDealers.map(({ dealer, distance, isOpen }) => (
                <Link key={dealer.id} href={`/dealer/${dealer.id}`}>
                  <Card className="group flex gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={dealer.logo_url ?? 'https://images.pexels.com/photos/264537/pexels-photo-264537.jpeg?auto=compress&cs=tinysrgb&w=200'}
                        alt={dealer.shop_name}
                        fill
                        sizes="96px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold group-hover:text-primary">{dealer.shop_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {dealer.category?.name ?? 'General Store'} · {dealer.city}
                          </p>
                        </div>
                        <Badge
                          variant={isOpen ? 'default' : 'secondary'}
                          className={cn('shrink-0', isOpen ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-muted-foreground')}
                        >
                          {isOpen ? 'Open Now' : 'Closed'}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {dealer.address}, {dealer.village ?? dealer.city}, {dealer.state} - {dealer.pin_code}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <MapPin className="h-4 w-4" /> {formatDistance(distance)}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Navigation2 className="h-4 w-4" /> {estimateDriveTime(distance)} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-warning text-warning" /> {dealer.rating.toFixed(1)}
                          <span className="text-muted-foreground">({dealer.rating_count})</span>
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ShoppingBag className="h-4 w-4" /> {dealer.product_count} products
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {dealer.delivery_available && (
                          <Badge variant="outline" className="border-success/30 text-success">Home Delivery</Badge>
                        )}
                        {dealer.pickup_available && (
                          <Badge variant="outline" className="border-primary/30 text-primary">Pickup</Badge>
                        )}
                        {dealer.whatsapp && (
                          <Badge variant="outline" className="border-success/30 text-success">WhatsApp</Badge>
                        )}
                        {isOpen && (
                          <span className="flex items-center gap-1 text-xs font-medium text-success">
                            <Clock className="h-3 w-3" /> Open now
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 pl-2">
                      <Button asChild size="sm" variant="outline" className="w-28">
                        <Link href={`tel:${dealer.phone}`}><Phone className="mr-1 h-3.5 w-3.5" /> Call</Link>
                      </Button>
                      {dealer.whatsapp && (
                        <Button asChild size="sm" variant="outline" className="w-28 border-success/40 text-success hover:bg-success/10">
                          <Link href={`https://wa.me/91${dealer.whatsapp}`} target="_blank"><MessageCircle className="mr-1 h-3.5 w-3.5" /> Chat</Link>
                        </Button>
                      )}
                      <Button asChild size="sm" className="w-28">
                        <Link href={`https://www.google.com/maps/dir/?api=1&destination=${dealer.map_lat},${dealer.map_lng}`} target="_blank">
                          <Navigation className="mr-1 h-3.5 w-3.5" /> Directions
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Become a dealer CTA */}
      {!loading && dealers.length > 0 && (
        <Card className="mt-6 overflow-hidden border-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5">
          <div className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <h3 className="text-lg font-bold">Are you a local shop owner?</h3>
              <p className="mt-1 text-sm text-muted-foreground">List your shop on DealerConnect AI and reach thousands of nearby customers.</p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/dealer/register"><Store className="mr-2 h-4 w-4" /> Become a Dealer <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
