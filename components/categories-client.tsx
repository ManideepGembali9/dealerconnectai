'use client';

import { ProductCard } from '@/components/product-card';
import { SendEnquiryDialog } from '@/components/send-enquiry-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchApprovedDealers, fetchCategories, fetchProducts } from '@/lib/data';
import { INITIAL_CATEGORIES } from '@/lib/seed-data';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Category, Dealer, Product } from '@/lib/types';
import {
  Apple,
  Armchair,
  ArrowLeft,
  Baby,
  BookOpen,
  Cake,
  Car,
  CircleDot,
  Cookie,
  CookingPot,
  Cpu,
  Dog,
  Dumbbell,
  Filter,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Glasses,
  HeartPulse,
  Home as HomeIcon,
  MessageCircle,
  MessageSquare,
  Monitor,
  Music,
  Palette,
  Phone,
  Pill,
  Refrigerator,
  Search,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sofa,
  SprayCan,
  Sprout,
  Star,
  Store,
  Tag,
  Trophy,
  Tv,
  Utensils,
  WashingMachine,
  Watch,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const ICON_MAP: Record<string, LucideIcon> = {
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
  Tv,
  Refrigerator,
  Zap,
  Watch,
  Glasses,
  Gem,
  CircleDot,
  Palette,
  ShoppingBag,
  Utensils,
  Cake,
  Cookie,
  Armchair,
  CookingPot,
  Wrench,
  Gift,
  Flower2,
  HeartPulse,
  Baby,
  Dumbbell,
  BookOpen,
  Gamepad2,
  Music,
  Car,
  Dog,
  Sprout,
  Cpu,
  Home: HomeIcon,
  Trophy,
  Tag,
};

function getCategoryIcon(cat: Category): LucideIcon {
  const s = cat.slug?.toLowerCase() || '';
  const n = cat.name?.toLowerCase() || '';

  if (s === 'electronics' || n.includes('electronic')) return Monitor;
  if (s === 'mobile-phones' || n.includes('mobile') || n.includes('phone')) return Smartphone;
  if (s === 'grocery' || n.includes('grocer')) return ShoppingBasket;
  if (s === 'fashion' || n.includes('fashion') || n.includes('apparel') || n.includes('shirt')) return Shirt;
  if (s === 'home-appliances' || n.includes('appliance') || n.includes('washer')) return WashingMachine;
  if (s === 'fruits-vegetables' || n.includes('fruit') || n.includes('vegetable')) return Apple;
  if (s === 'footwear' || n.includes('footwear') || n.includes('shoe')) return Footprints;
  if (s === 'cosmetics' || n.includes('cosmetic') || n.includes('beauty')) return SprayCan;
  if (s === 'furniture' || n.includes('furniture') || n.includes('sofa')) return Sofa;
  if (s === 'medical' || n.includes('medic') || n.includes('pharma')) return Pill;

  if (cat.icon && ICON_MAP[cat.icon]) return ICON_MAP[cat.icon];
  return Store;
}

function CategoryImageTile({ category }: { category: Category }) {
  const [imgFailed, setImgFailed] = useState(false);
  const CatIcon = getCategoryIcon(category);

  if (category.image_url && !imgFailed) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted/40">
        <Image
          src={category.image_url}
          alt={category.name}
          fill
          unoptimized
          onError={() => setImgFailed(true)}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-muted/60">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CatIcon className="h-7 w-7" />
      </div>
    </div>
  );
}

export function CategoriesClient({ initialCategorySlug }: { initialCategorySlug?: string } = {}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(() => {
    if (initialCategorySlug) {
      return INITIAL_CATEGORIES.find((c) => c.slug === initialCategorySlug) || null;
    }
    return null;
  });

  const [priceSort, setPriceSort] = useState<'all' | 'low-high' | 'high-low'>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [enquiryDealer, setEnquiryDealer] = useState<Dealer | null>(null);

  const loadCatalogData = useCallback(async () => {
    try {
      const [cats, dls, prods] = await Promise.all([
        fetchCategories(),
        fetchApprovedDealers(200),
        fetchProducts({ limit: 500 }),
      ]);
      if (cats && cats.length > 0) {
        setCategories(cats);
        if (initialCategorySlug) {
          const found = cats.find((c) => c.slug === initialCategorySlug);
          if (found) setSelectedCategory(found);
        }
      }
      if (dls) setDealers(dls);
      if (prods) setProducts(prods);
    } catch (err) {
      console.error('Error loading categories data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [initialCategorySlug]);

  useRealtimeSync(['categories', 'products', 'dealers'], loadCatalogData, {
    onReconnect: loadCatalogData,
  });

  useEffect(() => {
    loadCatalogData();
    const handleSync = () => loadCatalogData();
    window.addEventListener('dc-sync-event', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('dc-sync-event', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadCatalogData]);

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => {
      const inName = cat.name.toLowerCase().includes(q);
      const inDesc = Boolean(cat.description && cat.description.toLowerCase().includes(q));
      const inGroup = Boolean(cat.group_name && cat.group_name.toLowerCase().includes(q));
      const inSubs = Boolean(cat.subcategories?.some((s) => s.toLowerCase().includes(q)));
      return inName || inDesc || inGroup || inSubs;
    });
  }, [categories, searchFilter]);

  // Strictly match products belonging to selectedCategory.id
  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    const q = productSearch.trim().toLowerCase();

    return products
      .filter((p) => p.category_id === selectedCategory.id)
      .filter((p) => (inStockOnly ? p.stock_status === 'in_stock' : true))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          Boolean(p.description && p.description.toLowerCase().includes(q)) ||
          Boolean(p.brand?.name && p.brand.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const priceA = a.discount_price ?? a.price;
        const priceB = b.discount_price ?? b.price;
        if (priceSort === 'low-high') return priceA - priceB;
        if (priceSort === 'high-low') return priceB - priceA;
        return 0;
      });
  }, [products, selectedCategory, inStockOnly, productSearch, priceSort]);

  // Match approved dealers carrying products or registered in this category
  const categoryDealers = useMemo(() => {
    if (!selectedCategory) return [];
    const categoryProductAll = products.filter((p) => p.category_id === selectedCategory.id);
    return dealers.filter(
      (d) =>
        d.business_category_id === selectedCategory.id ||
        categoryProductAll.some((p) => p.dealer_id === d.id)
    );
  }, [dealers, products, selectedCategory]);

  if (selectedCategory) {
    /* ============================================================
       VIEW 1: SELECTED CATEGORY PRODUCTS PAGE (/categories/[slug])
       ============================================================ */
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/categories"
                aria-label="Back to Category"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">
                {selectedCategory.name}
              </h1>
            </div>
            <Link
              href="/"
              className="hidden md:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Home
            </Link>
          </div>
        </header>

        <div
          className="mx-auto w-full max-w-7xl px-3.5 sm:px-6 pt-4 sm:pt-6 space-y-5 sm:space-y-6"
          style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* Category Hero & Filters */}
          <Card className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                {selectedCategory.image_url ? (
                  <Image
                    src={selectedCategory.image_url}
                    alt={selectedCategory.name}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {(() => {
                      const IconComp = getCategoryIcon(selectedCategory);
                      return <IconComp className="h-7 w-7 text-primary" />;
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-1 min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-foreground tracking-tight">
                  {selectedCategory.name}
                </h2>
                {selectedCategory.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed line-clamp-2">
                    {selectedCategory.description}
                  </p>
                )}
              </div>
            </div>

            {/* Filter & In-Category Search */}
            <div className="mt-4 pt-4 border-t border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-bold flex items-center gap-1 text-foreground">
                  <Filter className="h-3.5 w-3.5" /> Sort:
                </span>
                <select
                  value={priceSort}
                  onChange={(e) => setPriceSort(e.target.value as 'all' | 'low-high' | 'high-low')}
                  className="rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="all">Default Relevance</option>
                  <option value="low-high">Price: Low to High</option>
                  <option value="high-low">Price: High to Low</option>
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold select-none text-foreground bg-muted/50 border border-border px-3 py-1.5 rounded-xl">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="accent-primary rounded"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={`Search in ${selectedCategory.name}...`}
                  className="h-9 pl-9 pr-8 text-xs rounded-xl"
                />
                {productSearch && (
                  <button
                    type="button"
                    aria-label="Clear product search"
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Products Section */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
              Products in {selectedCategory.name}
            </h3>

            {categoryProducts.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-border bg-card p-8 text-center space-y-2">
                <Store className="mx-auto h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-bold text-foreground">
                  No products found in {selectedCategory.name}
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  No verified items match your current filter in {selectedCategory.name}.
                </p>
                {(inStockOnly || priceSort !== 'all' || productSearch) && (
                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setInStockOnly(false);
                        setPriceSort('all');
                        setProductSearch('');
                      }}
                      variant="outline"
                      className="h-8 text-xs font-bold rounded-xl"
                    >
                      Reset Filters
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {categoryProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>

          {/* Verified Showrooms in this Category */}
          <div className="pt-2 space-y-4">
            <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
              <Store className="h-5 w-5" /> Verified Showrooms
            </h3>

            {loadingData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1].map((i) => (
                  <Card key={i} className="p-4 rounded-2xl h-32 animate-pulse bg-muted" />
                ))}
              </div>
            ) : categoryDealers.length === 0 ? (
              <Card className="rounded-2xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
                No verified stores are currently listed specifically for {selectedCategory.name}.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryDealers.map((d) => (
                  <Card
                    key={d.id}
                    className="p-4 rounded-2xl border border-border bg-card hover:border-foreground/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          <Image
                            src={
                              d.logo_url ||
                              'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=200'
                            }
                            alt={d.shop_name}
                            fill
                            unoptimized
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dealer/${d.id}`}
                            className="font-black text-sm text-foreground hover:underline line-clamp-1"
                          >
                            {d.shop_name}
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">
                            {d.city}, PIN {d.pin_code}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-foreground font-bold mt-0.5">
                            <Star className="h-3 w-3 fill-warning text-warning" /> {d.rating.toFixed(1)} ({d.rating_count} reviews)
                          </div>
                        </div>
                      </div>
                      {d.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                          {d.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setEnquiryDealer(d)}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs h-9 rounded-xl gap-1.5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Send Enquiry
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 rounded-xl border-border font-bold text-xs"
                      >
                        <Link href={`/dealer/${d.id}`}>Showroom</Link>
                      </Button>
                      {d.phone && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-9 px-2.5 rounded-xl border-border"
                        >
                          <a href={`tel:${d.phone}`} title="Call Dealer">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      {d.whatsapp && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-9 px-2.5 rounded-xl border-border"
                        >
                          <a
                            href={`https://wa.me/${d.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp Dealer"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

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

  /* ============================================================
     VIEW 2: CATEGORY INDEX PAGE (/categories)
     Minimal top header ("Category" + Search icon) + Clean 2-column Image Cards
     ============================================================ */
  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">Category</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Toggle category search"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            <Link
              href="/"
              className="hidden md:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Home
            </Link>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search category..."
              aria-label="Search categories"
              autoFocus={searchOpen}
              className="h-10 w-full rounded-2xl border-border bg-muted/40 pl-10 pr-10 text-sm focus-visible:bg-background"
            />
            {searchFilter && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div
        className="mx-auto max-w-7xl px-3.5 pt-4 sm:px-6 sm:pt-6"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {filteredCategories.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-border bg-card p-10 text-center space-y-3">
            <Search className="mx-auto h-9 w-9 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-base font-black text-foreground">
                No categories found for &quot;{searchFilter}&quot;
              </h2>
              <p className="text-xs text-muted-foreground">
                Try searching for another product category.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setSearchFilter('')}
              variant="outline"
              className="h-9 px-4 rounded-xl text-xs font-bold"
            >
              Clear Search
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {filteredCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group block touch-manipulation"
              >
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-2.5 sm:p-3 shadow-sm transition-all duration-200 hover:border-foreground/30 hover:shadow-md active:scale-[0.98]">
                  <CategoryImageTile category={cat} />
                  <h2 className="mt-2.5 px-1 pb-0.5 text-center text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                    {cat.name}
                  </h2>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
