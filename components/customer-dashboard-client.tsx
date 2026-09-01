'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Search, MessageSquare, Star, MapPin, TrendingUp, Package, Store, Sparkles, ArrowRight, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { supabase, type Product, type Dealer } from '@/lib/supabase';
import { formatINR, getEffectivePrice, timeAgo } from '@/lib/format';

export function CustomerDashboardClient() {
  const router = useRouter();
  const { role, customer, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ favorites: 0, searches: 0, enquiries: 0, dealers: 0 });
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [favoriteDealers, setFavoriteDealers] = useState<Dealer[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && role !== 'customer') {
      router.push('/customer/login');
      return;
    }
    if (customer) loadDashboard();
  }, [authLoading, role, customer]);

  const loadDashboard = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const [favRes, searchRes, enquiryRes, dealerFavRes] = await Promise.all([
        supabase.from('customer_favorites').select('*, product:product_id(*, category:category_id(*), brand:brand_id(*), dealer:dealer_id(*))').eq('user_id', customer.id).eq('type', 'product').limit(4),
        supabase.from('customer_search_history').select('*').eq('user_id', customer.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('enquiries').select('*', { count: 'exact', head: true }).eq('customer_id', customer.id),
        supabase.from('customer_favorites').select('*, dealer:dealer_id(*)').eq('user_id', customer.id).eq('type', 'dealer').limit(4),
      ]);

      const favProducts = (favRes.data ?? []).map((f: any) => f.product).filter(Boolean) as Product[];
      const favDealers = (dealerFavRes.data ?? []).map((f: any) => f.dealer).filter(Boolean) as Dealer[];

      setSavedProducts(favProducts);
      setFavoriteDealers(favDealers);
      setRecentSearches(searchRes.data ?? []);
      setStats({
        favorites: favProducts.length,
        searches: searchRes.data?.length ?? 0,
        enquiries: enquiryRes.count ?? 0,
        dealers: favDealers.length,
      });

      const { data: recs } = await supabase
        .from('products')
        .select('*, category:category_id(*), brand:brand_id(*), dealer:dealer_id(*)')
        .eq('is_trending', true)
        .eq('is_active', true)
        .limit(4);
      setRecommended(recs ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!customer) return null;

  const statCards = [
    { label: 'Saved Products', value: stats.favorites, icon: Heart, color: 'text-destructive', href: '/customer/favorites' },
    { label: 'Favorite Dealers', value: stats.dealers, icon: Store, color: 'text-primary', href: '/customer/favorites' },
    { label: 'Recent Searches', value: stats.searches, icon: Search, color: 'text-accent', href: '/customer/search-history' },
    { label: 'Active Enquiries', value: stats.enquiries, icon: MessageSquare, color: 'text-success', href: '/customer/enquiries' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome back, {customer.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">Your personalized dashboard for discovering products and connecting with dealers</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-4 transition-shadow hover:shadow-md">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Heart className="h-4 w-4 text-destructive" /> Saved Products</h3>
            <Link href="/customer/favorites" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {savedProducts.length > 0 ? (
            <div className="space-y-2">
              {savedProducts.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 truncate">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatINR(getEffectivePrice(p.price, p.discount_price))}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No saved products yet. Browse and save products you like.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Search className="h-4 w-4 text-primary" /> Recent Searches</h3>
            <Link href="/customer/search-history" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentSearches.length > 0 ? (
            <div className="space-y-2">
              {recentSearches.map((s) => (
                <Link key={s.id} href={`/search?q=${encodeURIComponent(s.query)}`} className="flex items-center justify-between rounded-lg p-2 hover:bg-muted">
                  <span className="flex items-center gap-2 text-sm">
                    {s.search_type === 'ai' ? <Sparkles className="h-3.5 w-3.5 text-accent" /> : <Search className="h-3.5 w-3.5 text-muted-foreground" />}
                    {s.query}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(s.created_at)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No recent searches. Start searching to see your history here.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Store className="h-4 w-4 text-primary" /> Favorite Dealers</h3>
            <Link href="/customer/favorites" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {favoriteDealers.length > 0 ? (
            <div className="space-y-2">
              {favoriteDealers.map((d) => (
                <Link key={d.id} href={`/dealer/${d.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {d.logo_url && <img src={d.logo_url} alt={d.shop_name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 truncate">
                    <p className="truncate text-sm font-medium">{d.shop_name}</p>
                    <p className="text-xs text-muted-foreground">{d.city}, {d.state}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs"><Star className="mr-1 h-3 w-3" />{d.rating.toFixed(1)}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No favorite dealers yet. Discover dealers near you.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Recommended Products</h3>
            <Link href="/search?sort=trending" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recommended.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {recommended.slice(0, 4).map((p) => (
                <Link key={p.id} href={`/product/${p.id}`} className="rounded-lg border p-2 hover:shadow-sm">
                  <div className="mb-1.5 h-16 w-full overflow-hidden rounded bg-muted">
                    {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />}
                  </div>
                  <p className="truncate text-xs font-medium">{p.name}</p>
                  <p className="text-xs text-primary font-semibold">{formatINR(getEffectivePrice(p.price, p.discount_price))}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No recommendations yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/nearby"><Button variant="outline"><MapPin className="mr-2 h-4 w-4" /> Nearby Dealers</Button></Link>
        <Link href="/search"><Button variant="outline"><Search className="mr-2 h-4 w-4" /> Search Products</Button></Link>
        <Link href="/ai-search"><Button variant="outline"><Sparkles className="mr-2 h-4 w-4" /> AI Search</Button></Link>
      </div>
    </div>
  );
}
