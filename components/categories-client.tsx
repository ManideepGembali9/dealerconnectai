'use client';

import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchApprovedDealers,fetchCategories,fetchProducts } from '@/lib/data';
import { CATEGORY_GROUPS,INITIAL_CATEGORIES } from '@/lib/seed-data';
import type { Category,Dealer,Product } from '@/lib/types';
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
  type LucideIcon
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect,useMemo,useState } from 'react';

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

// Maps any category to the 10 popular Lucide SVG icons or standard category icon
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
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Active Category (for category products view)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(() => {
    if (initialCategorySlug) {
      return INITIAL_CATEGORIES.find((c) => c.slug === initialCategorySlug) || null;
    }
    return null;
  });

  // Category Products Sort & Stock filters
  const [priceSort, setPriceSort] = useState<'all' | 'low-high' | 'high-low'>('all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [cats, dls, prods] = await Promise.all([
          fetchCategories(),
          fetchApprovedDealers(20),
          fetchProducts({ limit: 150 }),
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
      }
    })();
  }, [initialCategorySlug]);

  // Filter categories by search term and group
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        searchFilter.trim() === '' ||
        cat.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchesGroup = selectedGroup === 'all' || cat.group_id === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [categories, searchFilter, selectedGroup]);

  // Filter products for the active selected category
  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];

    return products
      .filter((p) => p.category_id === selectedCategory.id)
      .filter((p) => (inStockOnly ? p.stock_status === 'in_stock' : true))
      .filter((p) => {
        if (!productSearch.trim()) return true;
        const q = productSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
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

  // Nearby dealers carrying products in the selected category
  const categoryDealers = useMemo(() => {
    if (!selectedCategory) return [];
    return dealers.filter(
      (d) =>
        d.business_category_id === selectedCategory.id ||
        categoryProducts.some((p) => p.dealer_id === d.id)
    );
  }, [dealers, selectedCategory, categoryProducts]);

  // Handle switching category
  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setProductSearch('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-[#FFFFFF] min-h-screen text-[#000000] transition-colors pb-24 sm:pb-16">
      
      {/* ============================================================
          VIEW 1: SELECTED CATEGORY PRODUCTS PAGE
         ============================================================ */}
      {selectedCategory ? (
        <div className="space-y-6">
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
            <button
              type="button"
              onClick={handleBackToAllCategories}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#000000] hover:underline bg-[#F5F5F5] px-3.5 py-2 rounded-xl border border-[#E5E5E5] transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-[#000000]" /> Back to All Categories
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#000000] hover:underline px-3 py-1.5 rounded-lg border border-[#E5E5E5] bg-[#FFFFFF] hover:bg-[#F5F5F5] transition-all"
            >
              &larr; Home
            </Link>
          </div>

          {/* Category Header Card */}
          <Card className="rounded-3xl border border-[#E5E5E5] bg-[#FFFFFF] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Black Circular Background with White Lucide Icon */}
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full bg-[#000000] text-[#FFFFFF] shadow-sm">
                {(() => {
                  const IconComp = getCategoryIcon(selectedCategory);
                  return <IconComp className="h-8 w-8 sm:h-10 sm:w-10 text-[#FFFFFF] stroke-[2]" />;
                })()}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#F5F5F5] border border-[#E5E5E5] text-[#000000]">
                    {selectedCategory.group_name || 'Category'}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-[#000000] text-[#FFFFFF]">
                    Verified Catalog
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#000000] tracking-tight">
                  {selectedCategory.name}
                </h1>
                <p className="text-xs sm:text-sm text-[#000000]/70 max-w-2xl leading-relaxed">
                  {selectedCategory.description}
                </p>
              </div>
            </div>

            {/* Filter and In-Category Search Controls */}
            <div className="mt-6 pt-5 border-t border-[#E5E5E5] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold flex items-center gap-1 text-[#000000]">
                  <Filter className="h-3.5 w-3.5 text-[#000000]" /> Sort & Filter:
                </span>
                <select
                  value={priceSort}
                  onChange={(e) => setPriceSort(e.target.value as any)}
                  className="rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] px-3 py-1.5 text-xs font-bold text-[#000000] focus:outline-none focus:border-[#000000]"
                >
                  <option value="all">Default Relevance</option>
                  <option value="low-high">Price: Low to High</option>
                  <option value="high-low">Price: High to Low</option>
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer font-bold select-none text-[#000000] bg-[#F5F5F5] border border-[#E5E5E5] px-2.5 py-1.5 rounded-xl">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="accent-[#000000] rounded"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>

              {/* Product search within this category */}
              <div className="relative w-full md:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#000000]/50" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={`Search in ${selectedCategory.name}...`}
                  className="h-9 pl-9 pr-3 text-xs rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] text-[#000000] placeholder:text-[#000000]/50 focus:bg-[#FFFFFF] focus:border-[#000000]"
                />
              </div>
            </div>
          </Card>

          {/* Products Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-[#000000] tracking-tight">
                Products in {selectedCategory.name} ({categoryProducts.length})
              </h2>
            </div>

            {categoryProducts.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-[#E5E5E5] bg-[#FFFFFF] p-8 text-center space-y-2">
                <Store className="mx-auto h-8 w-8 text-[#000000]/30" />
                <h3 className="text-sm font-bold text-[#000000]">No products currently available</h3>
                <p className="text-xs text-[#000000]/60 max-w-md mx-auto">
                  No verified items match your current filter in {selectedCategory.name}. Check back soon or contact nearby dealers directly.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setInStockOnly(false);
                      setPriceSort('all');
                      setProductSearch('');
                    }}
                    variant="outline"
                    className="h-8 text-xs font-bold border-[#E5E5E5] text-[#000000] hover:bg-[#F5F5F5] rounded-xl"
                  >
                    Reset Filters
                  </Button>
                </div>
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
          <div className="pt-4 space-y-4">
            <h3 className="text-base sm:text-lg font-black text-[#000000] tracking-tight flex items-center gap-2">
              <Store className="h-5 w-5 text-[#000000]" /> Verified Neighborhood Dealers ({categoryDealers.length || dealers.slice(0, 2).length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(categoryDealers.length > 0 ? categoryDealers : dealers.slice(0, 2)).map((d) => (
                <Card
                  key={d.id}
                  className="p-4 rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF] hover:border-[#000000] transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#F5F5F5]">
                        <Image
                          src={d.logo_url || 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=200'}
                          alt={d.shop_name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <Link href={`/dealer/${d.id}`} className="font-black text-sm text-[#000000] hover:underline line-clamp-1">
                          {d.shop_name}
                        </Link>
                        <p className="text-xs text-[#000000]/70">{d.city}, PIN {d.pin_code}</p>
                        <div className="flex items-center gap-1 text-xs text-[#000000] font-bold mt-0.5">
                          <Star className="h-3 w-3 fill-current" /> {d.rating.toFixed(1)} ({d.rating_count} reviews)
                        </div>
                      </div>
                    </div>
                    {d.description && (
                      <p className="text-xs text-[#000000]/60 line-clamp-2 mt-2 leading-relaxed">
                        {d.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#E5E5E5] flex items-center gap-2">
                    <Button asChild size="sm" className="flex-1 bg-[#000000] text-[#FFFFFF] hover:bg-[#1a1a1a] font-bold text-xs h-8 rounded-xl">
                      <Link href={`/dealer/${d.id}`}>Visit Showroom</Link>
                    </Button>
                    {d.phone && (
                      <Button asChild size="sm" variant="outline" className="h-8 px-2.5 rounded-xl border-[#E5E5E5] text-[#000000] hover:bg-[#F5F5F5]">
                        <a href={`tel:${d.phone}`} title="Call Dealer"><Phone className="h-3.5 w-3.5 text-[#000000]" /></a>
                      </Button>
                    )}
                    {d.whatsapp && (
                      <Button asChild size="sm" variant="outline" className="h-8 px-2.5 rounded-xl border-[#E5E5E5] text-[#000000] hover:bg-[#F5F5F5]">
                        <a href={`https://wa.me/${d.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp Dealer">
                          <MessageSquare className="h-3.5 w-3.5 text-[#000000]" />
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================
            VIEW 2: FULL CATEGORIES PAGE (ALL CATEGORIES CATALOG)
           ============================================================ */
        <div className="space-y-6">
          {/* Back to Home Button */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#000000] hover:underline bg-[#F5F5F5] px-3.5 py-2 rounded-xl border border-[#E5E5E5] transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-[#000000]" /> Back to Home
            </Link>
          </div>

          {/* Page Banner & Search Bar */}
          <div className="rounded-3xl border border-[#E5E5E5] bg-[#FFFFFF] p-6 sm:p-8 shadow-sm">
            <h1 className="text-2xl sm:text-3xl font-black text-[#000000] tracking-tight">
              All Categories
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#000000]/70 max-w-2xl leading-relaxed">
              Explore verified local neighborhood inventory with real-time showroom availability.
            </p>

            {/* Category Search Input */}
            <div className="mt-5 relative max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#000000]/50" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search categories (e.g., Mobiles, Electronics, Grocery)..."
                className="h-11 pl-10 pr-9 text-xs sm:text-sm rounded-2xl bg-[#F5F5F5] text-[#000000] border border-[#E5E5E5] placeholder:text-[#000000]/50 focus:bg-[#FFFFFF] focus:border-[#000000]"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#000000]/50 hover:text-[#000000]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Group Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={cn(
                'rounded-xl px-3.5 py-2 text-xs font-bold transition-all border',
                selectedGroup === 'all'
                  ? 'bg-[#000000] text-[#FFFFFF] border-[#000000] shadow-sm'
                  : 'bg-[#FFFFFF] text-[#000000] border-[#E5E5E5] hover:bg-[#F5F5F5]'
              )}
            >
              All Categories ({categories.length})
            </button>
            {CATEGORY_GROUPS.map((grp) => (
              <button
                key={grp.id}
                type="button"
                onClick={() => setSelectedGroup(grp.id)}
                className={cn(
                  'rounded-xl px-3.5 py-2 text-xs font-bold transition-all border',
                  selectedGroup === grp.id
                    ? 'bg-[#000000] text-[#FFFFFF] border-[#000000] shadow-sm'
                    : 'bg-[#FFFFFF] text-[#000000] border-[#E5E5E5] hover:bg-[#F5F5F5]'
                )}
              >
                {grp.name}
              </button>
            ))}
          </div>

          {/* Responsive Grid of Categories */}
          <div className="space-y-8">
            {CATEGORY_GROUPS.filter((g) => selectedGroup === 'all' || g.id === selectedGroup).map((group) => {
              const groupCats = filteredCategories.filter((c) => c.group_id === group.id);
              if (groupCats.length === 0) return null;

              return (
                <div key={group.id} className="space-y-3.5">
                  <div className="border-b border-[#E5E5E5] pb-2">
                    <h2 className="text-base sm:text-lg font-black text-[#000000] tracking-tight">
                      {group.name}
                    </h2>
                    <p className="text-xs text-[#000000]/60">{group.description}</p>
                  </div>

                  {/* Responsive Grid Layout */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {groupCats.map((cat) => {
                      const CatIcon = getCategoryIcon(cat);
                      return (
                        <Card
                          key={cat.id}
                          onClick={() => handleSelectCategory(cat)}
                          className="group flex flex-col items-center justify-between rounded-2xl border border-[#E5E5E5] bg-[#FFFFFF] p-4 text-center hover:bg-[#F5F5F5] hover:border-[#000000] transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
                        >
                          {/* Centered Black Circular Background with White Lucide Icon */}
                          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#000000] text-[#FFFFFF] shadow-sm transition-transform duration-200 group-hover:scale-105 active:scale-95">
                            <CatIcon className="h-6 w-6 sm:h-7 sm:w-7 text-[#FFFFFF] stroke-[2]" />
                          </div>

                          {/* Clean Category Name Below */}
                          <div className="mt-3 w-full">
                            <h3 className="text-xs sm:text-sm font-bold text-[#000000] line-clamp-1 group-hover:underline">
                              {cat.name}
                            </h3>
                            <span className="text-[10px] text-[#000000]/60 block mt-0.5">
                              Verified Stores
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
        </div>
      )}

    </div>
  );
}
