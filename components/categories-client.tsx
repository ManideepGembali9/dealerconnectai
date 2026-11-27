'use client';

import { ProductCard } from '@/components/product-card';
import { SendEnquiryDialog } from '@/components/send-enquiry-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchApprovedDealers, fetchCategories, fetchProducts } from '@/lib/data';
import { CATEGORY_GROUPS, INITIAL_CATEGORIES } from '@/lib/seed-data';
import type { Category, Dealer, Product } from '@/lib/types';
import { cn } from '@/lib/utils';
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

export function CategoriesClient({ initialCategorySlug }: { initialCategorySlug?: string } = {}) {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
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
        fetchApprovedDealers(100),
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

  // Dynamic count of categories per group
  const categoryCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of categories) {
      const gid = c.group_id || 'other';
      counts[gid] = (counts[gid] || 0) + 1;
    }
    return counts;
  }, [categories]);

  // Accurate verified store count per category from real database dealers & products
  const storeCountByCategory = useMemo(() => {
    const approvedIds = new Set(dealers.map((d) => d.id));
    const map: Record<string, Set<string>> = {};

    for (const d of dealers) {
      if (d.business_category_id) {
        if (!map[d.business_category_id]) map[d.business_category_id] = new Set();
        map[d.business_category_id].add(d.id);
      }
    }

    for (const p of products) {
      if (p.category_id && p.dealer_id && approvedIds.has(p.dealer_id)) {
        if (!map[p.category_id]) map[p.category_id] = new Set();
        map[p.category_id].add(p.dealer_id);
      }
    }

    const counts: Record<string, number> = {};
    for (const catId of Object.keys(map)) {
      counts[catId] = map[catId].size;
    }
    return counts;
  }, [dealers, products]);

  // Filter categories by search term (name, description, group, subcategories) & group
  const filteredCategories = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return categories.filter((cat) => {
      const matchesGroup = selectedGroup === 'all' || cat.group_id === selectedGroup;
      if (!matchesGroup) return false;
      if (!q) return true;

      const inName = cat.name.toLowerCase().includes(q);
      const inDesc = Boolean(cat.description && cat.description.toLowerCase().includes(q));
      const inGroup = Boolean(cat.group_name && cat.group_name.toLowerCase().includes(q));
      const inSubs = Boolean(
        cat.subcategories?.some((s) => s.toLowerCase().includes(q))
      );
      return inName || inDesc || inGroup || inSubs;
    });
  }, [categories, searchFilter, selectedGroup]);

  // Filter products strictly belonging to selectedCategory
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

  // Strictly match real approved dealers carrying products or registered in this category
  const categoryDealers = useMemo(() => {
    if (!selectedCategory) return [];
    const categoryProductAll = products.filter((p) => p.category_id === selectedCategory.id);
    return dealers.filter(
      (d) =>
        d.business_category_id === selectedCategory.id ||
        categoryProductAll.some((p) => p.dealer_id === d.id)
    );
  }, [dealers, products, selectedCategory]);

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setProductSearch('');
    setPriceSort('all');
    setInStockOnly(false);
    router.push(`/categories/${cat.slug}`);
  };

  const handleBackToAllCategories = () => {
    setSelectedCategory(null);
    if (initialCategorySlug) {
      router.push('/categories');
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-7xl px-3.5 sm:px-6 pt-4 sm:pt-6 min-h-screen overflow-x-hidden bg-[#FFFFFF] dark:bg-[#0A0A0A] text-[#000000] dark:text-[#FFFFFF] transition-colors md:pb-16"
      style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* ============================================================
          VIEW 1: SELECTED CATEGORY PRODUCTS PAGE
         ============================================================ */}
      {selectedCategory ? (
        <div className="space-y-5 sm:space-y-6">
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E5E5] dark:border-[#292929] pb-3.5">
            <button
              type="button"
              onClick={handleBackToAllCategories}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#000000] dark:text-[#FFFFFF] bg-[#F5F5F5] dark:bg-[#151515] px-3.5 py-2 rounded-xl border border-[#E5E5E5] dark:border-[#292929] hover:bg-[#EBEBEB] dark:hover:bg-[#202020] transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" /> All Categories
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#000000] dark:text-[#FFFFFF] px-3 py-2 rounded-xl border border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] hover:bg-[#F5F5F5] dark:hover:bg-[#202020] transition-all"
            >
              &larr; Home
            </Link>
          </div>

          {/* Category Header Card */}
          <Card className="rounded-3xl border border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] p-5 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
              <div className="flex h-14 w-14 sm:h-18 sm:w-18 shrink-0 items-center justify-center rounded-full bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] shadow-sm">
                {(() => {
                  const IconComp = getCategoryIcon(selectedCategory);
                  return <IconComp className="h-7 w-7 sm:h-9 sm:w-9 stroke-[2]" />;
                })()}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#F5F5F5] dark:bg-[#202020] border border-[#E5E5E5] dark:border-[#292929] text-[#000000] dark:text-[#FFFFFF]">
                    {selectedCategory.group_name || 'Category'}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000]">
                    {loadingData
                      ? 'Loading stores...'
                      : `${categoryDealers.length} Verified ${categoryDealers.length === 1 ? 'Store' : 'Stores'}`}
                  </span>
                </div>
                <h1 className="text-xl sm:text-3xl font-black text-[#000000] dark:text-[#FFFFFF] tracking-tight">
                  {selectedCategory.name}
                </h1>
                {selectedCategory.description && (
                  <p className="text-xs sm:text-sm text-[#000000]/70 dark:text-[#A0A0A0] max-w-2xl leading-relaxed">
                    {selectedCategory.description}
                  </p>
                )}
              </div>
            </div>

            {/* Filter and In-Category Search Controls */}
            <div className="mt-5 pt-4 border-t border-[#E5E5E5] dark:border-[#292929] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-bold flex items-center gap-1 text-[#000000] dark:text-[#FFFFFF]">
                  <Filter className="h-3.5 w-3.5" /> Sort:
                </span>
                <select
                  value={priceSort}
                  onChange={(e) => setPriceSort(e.target.value as any)}
                  className="rounded-xl border border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#202020] px-3 py-1.5 text-xs font-bold text-[#000000] dark:text-[#FFFFFF] focus:outline-none focus:border-[#000000]"
                >
                  <option value="all">Default Relevance</option>
                  <option value="low-high">Price: Low to High</option>
                  <option value="high-low">Price: High to Low</option>
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold select-none text-[#000000] dark:text-[#FFFFFF] bg-[#F5F5F5] dark:bg-[#202020] border border-[#E5E5E5] dark:border-[#292929] px-3 py-1.5 rounded-xl">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="accent-[#000000] rounded"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#000000]/50 dark:text-[#A0A0A0]" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={`Search in ${selectedCategory.name}...`}
                  className="h-9 pl-9 pr-8 text-xs rounded-xl bg-[#F5F5F5] dark:bg-[#202020] border border-[#E5E5E5] dark:border-[#292929] text-[#000000] dark:text-[#FFFFFF] placeholder:text-[#000000]/50 dark:placeholder:text-[#A0A0A0]"
                />
                {productSearch && (
                  <button
                    type="button"
                    aria-label="Clear product search"
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#000000]/50 dark:text-[#A0A0A0]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Products Section */}
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-black text-[#000000] dark:text-[#FFFFFF] tracking-tight">
              Products in {selectedCategory.name} ({categoryProducts.length})
            </h2>

            {categoryProducts.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] p-8 text-center space-y-2">
                <Store className="mx-auto h-8 w-8 text-[#000000]/30 dark:text-[#A0A0A0]" />
                <h3 className="text-sm font-bold text-[#000000] dark:text-[#FFFFFF]">
                  No products found in {selectedCategory.name}
                </h3>
                <p className="text-xs text-[#000000]/60 dark:text-[#A0A0A0] max-w-md mx-auto">
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
                      className="h-8 text-xs font-bold border-[#E5E5E5] dark:border-[#292929] rounded-xl"
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

          {/* Real Verified Showrooms in this Category */}
          <div className="pt-2 space-y-4">
            <h3 className="text-base sm:text-lg font-black text-[#000000] dark:text-[#FFFFFF] tracking-tight flex items-center gap-2">
              <Store className="h-5 w-5" /> Verified Showrooms ({categoryDealers.length})
            </h3>

            {categoryDealers.length === 0 ? (
              <Card className="rounded-2xl border border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] p-6 text-center text-xs text-[#000000]/60 dark:text-[#A0A0A0]">
                No verified stores are currently listed specifically for {selectedCategory.name}.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryDealers.map((d) => (
                  <Card
                    key={d.id}
                    className="p-4 rounded-2xl border border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] hover:border-[#000000] dark:hover:border-[#FFFFFF] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#E5E5E5] dark:border-[#292929] bg-[#F5F5F5] dark:bg-[#202020]">
                          <Image
                            src={d.logo_url || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=200'}
                            alt={d.shop_name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dealer/${d.id}`}
                            className="font-black text-sm text-[#000000] dark:text-[#FFFFFF] hover:underline line-clamp-1"
                          >
                            {d.shop_name}
                          </Link>
                          <p className="text-xs text-[#000000]/70 dark:text-[#A0A0A0] truncate">
                            {d.city}, PIN {d.pin_code}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-[#000000] dark:text-[#FFFFFF] font-bold mt-0.5">
                            <Star className="h-3 w-3 fill-current" /> {d.rating.toFixed(1)} ({d.rating_count} reviews)
                          </div>
                        </div>
                      </div>
                      {d.description && (
                        <p className="text-xs text-[#000000]/60 dark:text-[#A0A0A0] line-clamp-2 mt-2 leading-relaxed">
                          {d.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#E5E5E5] dark:border-[#292929] flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setEnquiryDealer(d)}
                        className="flex-1 bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] hover:opacity-90 font-bold text-xs h-9 rounded-xl gap-1.5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Send Enquiry
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 rounded-xl border-[#E5E5E5] dark:border-[#292929] font-bold text-xs"
                      >
                        <Link href={`/dealer/${d.id}`}>Showroom</Link>
                      </Button>
                      {d.phone && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-9 px-2.5 rounded-xl border-[#E5E5E5] dark:border-[#292929]"
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
                          className="h-9 px-2.5 rounded-xl border-[#E5E5E5] dark:border-[#292929]"
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
      ) : (
        /* ============================================================
            VIEW 2: FULL CATEGORIES PAGE (ALL CATEGORIES CATALOG)
           ============================================================ */
        <div className="space-y-5 sm:space-y-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#000000] dark:text-[#FFFFFF] bg-[#F5F5F5] dark:bg-[#151515] px-3.5 py-2 rounded-xl border border-[#E5E5E5] dark:border-[#292929] hover:bg-[#EBEBEB] dark:hover:bg-[#202020] transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" /> Back to Home
            </Link>
          </div>

          {/* Page Banner & Responsive Category Search Bar */}
          <div className="rounded-3xl border border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] p-5 sm:p-7 shadow-sm">
            <h1 className="text-2xl sm:text-3xl font-black text-[#000000] dark:text-[#FFFFFF] tracking-tight">
              All Categories
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#000000]/70 dark:text-[#A0A0A0] max-w-2xl leading-relaxed">
              Explore {categories.length} local product categories across {CATEGORY_GROUPS.length} sections with verified store counts.
            </p>

            {/* Search Bar — clean concise placeholder that never clips on small mobile */}
            <div className="mt-4 relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#000000]/50 dark:text-[#A0A0A0]" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search categories..."
                aria-label="Search categories"
                className="h-11 w-full pl-10 pr-10 text-sm rounded-2xl bg-[#F5F5F5] dark:bg-[#202020] text-[#000000] dark:text-[#FFFFFF] border border-[#E5E5E5] dark:border-[#292929] placeholder:text-[#000000]/50 dark:placeholder:text-[#A0A0A0] focus:bg-[#FFFFFF] dark:focus:bg-[#151515] focus:border-[#000000] dark:focus:border-[#FFFFFF]"
              />
              {searchFilter && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#000000]/60 dark:text-[#A0A0A0] hover:text-[#000000] dark:hover:text-[#FFFFFF]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Responsive Group Filter Pills with Dynamic Category Counts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-hide md:flex-wrap md:overflow-visible">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all border',
                selectedGroup === 'all'
                  ? 'bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] border-[#000000] dark:border-[#FFFFFF] shadow-sm'
                  : 'bg-[#FFFFFF] dark:bg-[#151515] text-[#000000] dark:text-[#FFFFFF] border-[#E5E5E5] dark:border-[#292929] hover:bg-[#F5F5F5] dark:hover:bg-[#202020]'
              )}
            >
              All Categories ({categories.length})
            </button>
            {CATEGORY_GROUPS.map((grp) => {
              const count = categoryCountByGroup[grp.id] ?? 0;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setSelectedGroup(grp.id)}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition-all border',
                    selectedGroup === grp.id
                      ? 'bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] border-[#000000] dark:border-[#FFFFFF] shadow-sm'
                      : 'bg-[#FFFFFF] dark:bg-[#151515] text-[#000000] dark:text-[#FFFFFF] border-[#E5E5E5] dark:border-[#292929] hover:bg-[#F5F5F5] dark:hover:bg-[#202020]'
                  )}
                >
                  {grp.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Empty State if no categories match search/filter */}
          {filteredCategories.length === 0 ? (
            <Card className="rounded-3xl border border-dashed border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] p-10 text-center space-y-3">
              <Search className="mx-auto h-9 w-9 text-[#000000]/30 dark:text-[#A0A0A0]" />
              <div className="space-y-1">
                <h2 className="text-base font-black text-[#000000] dark:text-[#FFFFFF]">
                  No categories found
                </h2>
                <p className="text-xs text-[#000000]/60 dark:text-[#A0A0A0]">
                  We couldn&apos;t find any category matching &quot;{searchFilter}&quot;.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setSearchFilter('');
                  setSelectedGroup('all');
                }}
                className="h-9 px-4 rounded-xl bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] text-xs font-bold"
              >
                Show All Categories
              </Button>
            </Card>
          ) : (
            <div className="space-y-8">
              {CATEGORY_GROUPS.filter(
                (g) => selectedGroup === 'all' || g.id === selectedGroup
              ).map((group) => {
                const groupCats = filteredCategories.filter((c) => c.group_id === group.id);
                if (groupCats.length === 0) return null;

                return (
                  <div key={group.id} className="space-y-3.5">
                    <div className="flex items-baseline justify-between gap-2 border-b border-[#E5E5E5] dark:border-[#292929] pb-2">
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-black text-[#000000] dark:text-[#FFFFFF] tracking-tight">
                          {group.name}
                        </h2>
                        <p className="text-xs text-[#000000]/60 dark:text-[#A0A0A0] line-clamp-1">
                          {group.description}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#000000]/60 dark:text-[#A0A0A0] shrink-0">
                        {groupCats.length} {groupCats.length === 1 ? 'category' : 'categories'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                      {groupCats.map((cat) => {
                        const CatIcon = getCategoryIcon(cat);
                        const storeCount = storeCountByCategory[cat.id] ?? 0;
                        return (
                          <Card
                            key={cat.id}
                            onClick={() => handleSelectCategory(cat)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSelectCategory(cat);
                              }
                            }}
                            className="group h-full min-h-[148px] sm:min-h-[164px] flex flex-col items-center justify-between rounded-2xl border border-[#E5E5E5] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] p-3.5 sm:p-4 text-center hover:bg-[#F5F5F5] dark:hover:bg-[#202020] hover:border-[#000000] dark:hover:border-[#FFFFFF] transition-all duration-200 cursor-pointer shadow-sm active:scale-95 touch-manipulation"
                          >
                            <div className="flex h-13 w-13 sm:h-15 sm:w-15 shrink-0 items-center justify-center rounded-full bg-[#000000] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#000000] shadow-sm transition-transform duration-200 group-hover:scale-105">
                              <CatIcon className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2]" />
                            </div>

                            <div className="mt-3 w-full min-w-0">
                              <h3 className="text-xs sm:text-sm font-bold text-[#000000] dark:text-[#FFFFFF] line-clamp-2 group-hover:underline">
                                {cat.name}
                              </h3>
                              <span className="text-[11px] font-medium text-[#000000]/65 dark:text-[#A0A0A0] block mt-1 truncate">
                                {loadingData
                                  ? 'Checking stores...'
                                  : `${storeCount} ${storeCount === 1 ? 'Verified Store' : 'Verified Stores'}`}
                              </span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
