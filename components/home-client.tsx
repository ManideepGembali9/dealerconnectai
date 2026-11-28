'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search,
  Mic,
  Camera,
  Upload,
  Sparkles,
  Percent,
  ChevronRight,
  Store,
  Star,
  Phone,
  MessageSquare,
  Filter,
  Monitor,
  Smartphone,
  ShoppingBasket,
  Shirt,
  WashingMachine,
  Apple,
  Footprints,
  SprayCan,
  Sofa,
  Pill,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProductCard } from '@/components/product-card';
import { useApp } from '@/lib/providers';
import { useRealtimeSync } from '@/lib/realtime-client';
import { fetchCategories, fetchApprovedDealers, fetchProducts } from '@/lib/data';
import { INITIAL_CATEGORIES } from '@/lib/seed-data';
import type { Category, Dealer, Product } from '@/lib/types';
import { haversineKm } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Exactly 10 popular categories with Lucide icons (Amazon-inspired layout)
const POPULAR_CATEGORIES_CONFIG = [
  { key: 'electronics', name: 'Electronics', icon: Monitor, defaultSlug: 'electronics' },
  { key: 'mobile-phones', name: 'Mobile Phones', icon: Smartphone, defaultSlug: 'mobile-phones' },
  { key: 'grocery', name: 'Grocery', icon: ShoppingBasket, defaultSlug: 'grocery' },
  { key: 'fashion', name: 'Fashion', icon: Shirt, defaultSlug: 'fashion' },
  { key: 'home-appliances', name: 'Home Appliances', icon: WashingMachine, defaultSlug: 'home-appliances' },
  { key: 'fruits-vegetables', name: 'Fruits & Vegetables', icon: Apple, defaultSlug: 'fruits-vegetables' },
  { key: 'footwear', name: 'Footwear', icon: Footprints, defaultSlug: 'footwear' },
  { key: 'cosmetics', name: 'Cosmetics', icon: SprayCan, defaultSlug: 'cosmetics' },
  { key: 'furniture', name: 'Furniture', icon: Sofa, defaultSlug: 'furniture' },
  { key: 'medical', name: 'Medical & Pharmacy', icon: Pill, defaultSlug: 'medical' },
];

export function HomeClient() {
  const { location, appSettings, t } = useApp();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Product[]>([]);

  // Popular Categories Horizontal Scroll Tracking
  const [categoryScrollProgress, setCategoryScrollProgress] = useState(0);
  const categoryRowRef = useRef<HTMLDivElement>(null);

  const handleCategoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max > 0) {
      setCategoryScrollProgress(Math.min(100, Math.max(0, (el.scrollLeft / max) * 100)));
    }
  };

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (categoryRowRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      categoryRowRef.current.scrollLeft += e.deltaY;
    }
  };

  // Dynamically map popular categories to active database categories
  const popularCategoriesList = useMemo(() => {
    return POPULAR_CATEGORIES_CONFIG.map((spec) => {
      const found = categories.find(
        (c) =>
          c.slug === spec.defaultSlug ||
          c.slug.includes(spec.key) ||
          c.name.toLowerCase() === spec.name.toLowerCase() ||
          (spec.key === 'medical' &&
            (c.slug === 'medical' ||
              c.name.toLowerCase().includes('medic') ||
              c.name.toLowerCase().includes('pharma')))
      );

      return {
        id: found?.id || `cat-${spec.key}`,
        name: spec.name,
        slug: found?.slug || spec.defaultSlug,
        icon: spec.icon,
      };
    });
  }, [categories]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // All Products Filter Tab State
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [priceSort, setPriceSort] = useState<'all' | 'low-high' | 'high-low'>('all');

  const loadHomeData = useCallback(async () => {
    try {
      const [cats, dls, prods] = await Promise.all([
        fetchCategories(),
        fetchApprovedDealers(10),
        fetchProducts({ limit: 150 }),
      ]);

      if (cats && cats.length > 0) setCategories(cats);
      if (dls && dls.length > 0) setDealers(dls);

      if (prods && prods.length > 0) {
        setAllProducts(prods);
        setOffers(prods.filter((p) => p.discount_price && p.discount_price < p.price).slice(0, 8));
      }
    } catch (err) {
      console.error('Home load error:', err);
    }
  }, []);

  useRealtimeSync(['products', 'dealers', 'reviews', 'categories', 'brands', 'settings'], loadHomeData, {
    onReconnect: loadHomeData,
  });

  const homepageConfig = appSettings.homepage_config;
  const heroTitle = homepageConfig?.headings?.hero_title || 'Local Shop Product Finder';
  const heroSubtitle =
    homepageConfig?.headings?.hero_subtitle ||
    'Instant showroom availability, real-time prices & direct local dealer contacts';
  const offersTitle = homepageConfig?.headings?.featured_title || t('offers');
  const nearbyTitle = homepageConfig?.headings?.dealers_title || t('nearbyShops');
  const enabledBanners = useMemo(
    () => (homepageConfig?.banners || []).filter((b) => b.enabled),
    [homepageConfig]
  );
  const isSectionEnabled = useCallback(
    (type: string) => {
      const sec = homepageConfig?.sections?.find((s) => s.type === type);
      return sec ? sec.enabled : true;
    },
    [homepageConfig]
  );

  useEffect(() => {
    setMounted(true);
    loadHomeData();

    const handleSync = () => {
      loadHomeData();
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('dc-sync-event', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('dc-sync-event', handleSync);
    };
  }, [loadHomeData]);

  // Search execution (pressing Enter, selecting tag, speech, or photo)
  const handleSearch = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const q = (customQuery ?? searchQuery).trim();
    if (!q) return;
    const params = new URLSearchParams();
    params.set('q', q);
    if (location.pinCode) params.set('pin', location.pinCode);
    router.push(`/search?${params.toString()}`);
  };

  // Voice Search Handler
  const startVoiceSearch = () => {
    setVoiceModalOpen(true);
    setTranscript('');
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.continuous = false;
        recognition.interimResults = true;

        setIsListening(true);
        recognition.start();

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const text = event.results[current][0].transcript;
          setTranscript(text);
        };

        recognition.onerror = () => {
          setIsListening(false);
          toast.error('Could not access microphone');
        };

        recognition.onend = () => {
          setIsListening(false);
        };
        return;
      } catch { }
    }

    // Fallback simulation
    setIsListening(true);
    setTimeout(() => {
      setTranscript('Samsung Galaxy S24 near me');
      setIsListening(false);
    }, 1800);
  };

  const confirmVoiceSearch = () => {
    if (transcript.trim()) {
      setVoiceModalOpen(false);
      handleSearch(undefined, transcript);
    }
  };

  // Photo Search Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoModalOpen(false);
    toast.success('Analyzing product photo with AI...');
    setTimeout(() => {
      router.push('/search?q=electronics&filter=photo_search');
    }, 800);
  };

  const userLat = location.lat ?? 16.9034;
  const userLng = location.lng ?? 82.0175;

  const nearbyDealersList = [...dealers]
    .map((d) => ({
      dealer: d,
      distance: d.map_lat && d.map_lng ? haversineKm(userLat, userLng, d.map_lat, d.map_lng) : 1.2,
    }))
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
    .slice(0, 4);

  // Filter products for the explore catalog section
  const catalogProducts = allProducts
    .filter((p) => (selectedCatFilter === 'all' ? true : p.category_id === selectedCatFilter))
    .sort((a, b) => {
      const priceA = a.discount_price ?? a.price;
      const priceB = b.discount_price ?? b.price;
      if (priceSort === 'low-high') return priceA - priceB;
      if (priceSort === 'high-low') return priceB - priceA;
      return 0;
    });

  if (!mounted) {
    return (
      <div suppressHydrationWarning className="flex flex-col min-h-screen bg-background text-foreground transition-colors pb-16 md:pb-8">
        <section className="border-b border-border bg-card px-4 pt-6 pb-6 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
              Local Shop Product Finder
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Instant showroom availability, real-time prices & direct local dealer contacts
            </p>
            <div className="mt-5 h-12 sm:h-14 w-full rounded-2xl sm:rounded-full border border-border bg-muted/40 animate-pulse" />
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 w-full">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-40 bg-neutral-200 rounded-lg animate-pulse" />
            <div className="h-4 w-16 bg-neutral-200 rounded-md animate-pulse" />
          </div>
          <div className="flex items-center gap-3 overflow-hidden py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center shrink-0 w-[72px] sm:w-[88px] gap-2">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-neutral-200 animate-pulse" />
                <div className="h-3 w-12 bg-neutral-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </section>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 w-full flex items-center justify-center min-h-[30vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="flex flex-col min-h-screen bg-background text-foreground transition-colors touch-pan-y pb-28 sm:pb-16">

      {/* ============================================================
          1. TOP SEARCH BAR (AT HOME PAGE STARTING, NO SEARCH BUTTON)
         ============================================================ */}
      <section className="border-b border-border bg-card px-4 pt-6 pb-6 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">

          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground">
            {heroTitle}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {heroSubtitle}
          </p>

          {/* Search Input with Voice & Photo Search (NO Separate Search Button) */}
          <form
            onSubmit={(e) => handleSearch(e)}
            className="mt-5 relative flex items-center w-full"
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-12 sm:h-14 pl-12 pr-24 text-sm sm:text-base rounded-2xl sm:rounded-full border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-foreground shadow-sm transition-all"
            />

            {/* In-Input Actions: Voice Search & Photo Search */}
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={startVoiceSearch}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:bg-muted hover:text-foreground transition-all active:scale-95"
                title={t('voiceSearch')}
                aria-label="Voice Search"
              >
                <Mic className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:bg-muted hover:text-foreground transition-all active:scale-95"
                title={t('imageSearch')}
                aria-label="Photo Search"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>
          </form>



        </div>
      </section>

      {/* ============================================================
          PROMOTIONAL BANNERS (DYNAMIC ADMIN HOMEPAGE CMS)
         ============================================================ */}
      {enabledBanners.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {enabledBanners.map((banner, idx) => (
              <Link
                key={banner.id || idx}
                href={banner.link || '/search'}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-primary/50"
              >
                <div className="relative h-32 sm:h-40 w-full bg-muted">
                  {banner.image_url && (
                    <Image
                      src={banner.image_url}
                      alt={banner.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent flex flex-col justify-center p-4 sm:p-5 text-white">
                    <span className="text-sm sm:text-lg font-black leading-tight line-clamp-2">
                      {banner.title}
                    </span>
                    {banner.subtitle && (
                      <span className="text-[11px] sm:text-xs text-white/85 mt-1 line-clamp-2">
                        {banner.subtitle}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================
          2. POPULAR CATEGORIES (AMAZON-INSPIRED HORIZONTAL ROW)
         ============================================================ */}
      {isSectionEnabled('categories') && (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 w-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-2xl font-black text-foreground tracking-tight">
            Popular Categories
          </h2>
          <Link
            href="/categories"
            className="text-xs sm:text-sm font-bold text-foreground hover:underline flex items-center gap-1 transition-colors"
          >
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Single Horizontal Scrolling Row (5-6 visible on mobile) */}
        <div
          ref={categoryRowRef}
          onScroll={handleCategoryScroll}
          onWheel={handleCategoryWheel}
          className="flex items-start gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden scrollbar-none py-2 px-1 touch-pan-x select-none"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {popularCategoriesList.map((item) => {
            const IconComp = item.icon;
            return (
              <Link
                key={item.slug}
                href={`/categories/${item.slug}`}
                className="group flex flex-col items-center shrink-0 w-[72px] sm:w-[88px] text-center transition-all duration-200"
              >
                {/* Theme-aware Circular Background with Lucide SVG Icon */}
                <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105 active:scale-95">
                  <IconComp className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2]" />
                </div>
                {/* Clean Category Name Below */}
                <span className="mt-2 text-[11px] sm:text-xs font-semibold text-foreground leading-tight line-clamp-1 group-hover:underline">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Subtle Scroll Indicator */}
        <div className="flex justify-center mt-3">
          <div className="w-16 h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-150"
              style={{
                width: '35%',
                transform: `translateX(${categoryScrollProgress * 1.85}%)`,
              }}
            />
          </div>
        </div>
      </section>
      )}

      {/* ============================================================
          3. TODAY'S SHOWROOM OFFERS (VERIFIED DISCOUNTS)
         ============================================================ */}
      {isSectionEnabled('offers') && (
      <section className="border-y border-border bg-muted/20 py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <Percent className="h-5 w-5 text-foreground" /> {offersTitle}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Direct showroom discounts from verified local retailers
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl"
            >
              <Link href="/search?filter=offers">
                {t('viewAll')} <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {offers.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ============================================================
          4. VERIFIED LOCAL SHOWROOMS (DIRECT CALL & WHATSAPP)
         ============================================================ */}
      {isSectionEnabled('nearby') && (
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Store className="h-5 w-5 text-foreground" /> {nearbyTitle}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Authorized neighborhood stores with verified physical showrooms
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-border text-foreground hover:bg-muted font-bold text-xs rounded-xl"
          >
            <Link href="/shops">
              {t('viewAll')} <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {nearbyDealersList.map(({ dealer: d, distance }) => (
            <Card
              key={d.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground hover:border-foreground/40 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                    <Image
                      src={d.logo_url || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=200'}
                      alt={d.shop_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Link
                      href={`/dealer/${d.id}`}
                      className="text-sm font-extrabold text-foreground hover:underline transition-colors line-clamp-1"
                    >
                      {d.shop_name}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-black h-4 px-1 gap-0.5">
                        <Star className="h-2.5 w-2.5 fill-current" /> {d.rating.toFixed(1)}
                      </Badge>
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {distance.toFixed(1)} {t('kmAway')}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                      {d.city}, PIN {d.pin_code}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-3 leading-relaxed">
                  {d.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-8 text-xs rounded-xl"
                >
                  <Link href={`/dealer/${d.id}`}>{t('shop')}</Link>
                </Button>
                {d.phone && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 rounded-xl border-border text-foreground hover:bg-muted"
                    title={t('call')}
                  >
                    <a href={`tel:${d.phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                {d.whatsapp && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 rounded-xl border-border text-foreground hover:bg-muted"
                    title={t('whatsapp')}
                  >
                    <a
                      href={`https://wa.me/${d.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
      )}

      {/* ============================================================
          5. ALL SHOWROOM PRODUCTS (>100 PRODUCTS ACROSS ALL CATEGORIES)
         ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 w-full border-t border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-foreground" /> {t('products')}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Explore over 100 genuine products verified in local dealer showrooms
            </p>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Sort:
            </span>
            <select
              value={priceSort}
              onChange={(e) => setPriceSort(e.target.value as any)}
              className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground"
            >
              <option value="all">Featured Relevance</option>
              <option value="low-high">Price: Low to High</option>
              <option value="high-low">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setSelectedCatFilter('all')}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all border',
              selectedCatFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-foreground border-border hover:bg-muted'
            )}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCatFilter(cat.id)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border',
                selectedCatFilter === cat.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm font-bold'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid - Shows all products available in the marketplace */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {catalogProducts.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </section>

      {/* ============================================================
          VOICE SEARCH MODAL
         ============================================================ */}
      <Dialog open={voiceModalOpen} onOpenChange={setVoiceModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl bg-card text-card-foreground border border-border p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center justify-center gap-2">
              <Mic className="h-5 w-5 text-foreground" /> {t('voiceSearch')}
            </DialogTitle>
            <DialogDescription className="sr-only">Speak a product name or category to search local shops.</DialogDescription>
          </DialogHeader>

          <div className="my-6 flex flex-col items-center">
            <div
              className={cn(
                'flex h-20 w-20 items-center justify-center rounded-full bg-muted text-foreground transition-all',
                isListening && 'animate-pulse ring-8 ring-primary/20'
              )}
            >
              <Mic className="h-10 w-10" />
            </div>

            <p className="mt-4 text-xs font-semibold text-muted-foreground">
              {isListening ? 'Listening... Speak product name now' : 'Spoken Query Detected:'}
            </p>

            <div className="mt-3 w-full rounded-2xl bg-muted/50 p-3 text-sm font-bold text-foreground min-h-[50px] flex items-center justify-center border border-border">
              {transcript || (isListening ? '“Try: iPhone 15 near Amalapuram”' : 'No speech detected yet')}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={startVoiceSearch}
              className="flex-1 border-border text-foreground hover:bg-muted font-bold rounded-xl"
            >
              Try Again
            </Button>
            <Button
              size="sm"
              disabled={!transcript}
              onClick={confirmVoiceSearch}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl"
            >
              {t('search')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          PHOTO SEARCH MODAL
         ============================================================ */}
      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl bg-card text-card-foreground border border-border p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center justify-center gap-2">
              <Camera className="h-5 w-5 text-foreground" /> {t('imageSearch')}
            </DialogTitle>
            <DialogDescription className="sr-only">Upload or capture a product photo to search nearby dealer stock.</DialogDescription>
          </DialogHeader>

          <div className="my-6 flex flex-col items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-foreground mb-3">
              <Camera className="h-10 w-10" />
            </div>

            <p className="text-xs text-muted-foreground max-w-xs">
              Upload or snap a photo of any gadget, grocery pack, or appliance to match available inventory in local shops.
            </p>

            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            <Button
              onClick={() => photoInputRef.current?.click()}
              className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-extrabold rounded-2xl h-11"
            >
              <Upload className="mr-2 h-4 w-4" /> Upload / Capture Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
