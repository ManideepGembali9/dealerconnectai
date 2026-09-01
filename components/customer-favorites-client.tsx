'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Trash2, Store, Package, Star, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { supabase, type Product, type Dealer } from '@/lib/supabase';
import { formatINR, getEffectivePrice } from '@/lib/format';
import { toast } from 'sonner';

export function CustomerFavoritesClient() {
  const router = useRouter();
  const { role, customer, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && role !== 'customer') { router.push('/customer/login'); return; }
    if (customer) loadFavorites();
  }, [authLoading, role, customer]);

  const loadFavorites = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const [prodRes, dealerRes] = await Promise.all([
        supabase.from('customer_favorites').select('*, product:product_id(*, category:category_id(*), brand:brand_id(*), dealer:dealer_id(*))').eq('user_id', customer.id).eq('type', 'product'),
        supabase.from('customer_favorites').select('*, dealer:dealer_id(*)').eq('user_id', customer.id).eq('type', 'dealer'),
      ]);
      setProducts((prodRes.data ?? []).map((f: any) => f.product).filter(Boolean));
      setDealers((dealerRes.data ?? []).map((f: any) => f.dealer).filter(Boolean));
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const removeFavorite = async (id: string, type: 'product' | 'dealer') => {
    if (!customer) return;
    try {
      await supabase.from('customer_favorites').delete().eq('user_id', customer.id).eq('type', type).eq(type === 'product' ? 'product_id' : 'dealer_id', id);
      if (type === 'product') setProducts((prev) => prev.filter((p) => p.id !== id));
      else setDealers((prev) => prev.filter((d) => d.id !== id));
      toast.success('Removed from favorites');
    } catch { toast.error('Failed to remove'); }
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!customer) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Your Favorites</h1>
      <p className="mb-6 text-sm text-muted-foreground">Products and dealers you&apos;ve saved</p>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products"><Package className="mr-1.5 h-4 w-4" /> Products ({products.length})</TabsTrigger>
          <TabsTrigger value="dealers"><Store className="mr-1.5 h-4 w-4" /> Dealers ({dealers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          {products.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="overflow-hidden p-0">
                  <div className="relative h-40 bg-muted">
                    {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />}
                    <Button size="icon" variant="secondary" className="absolute right-2 top-2 h-8 w-8" onClick={() => removeFavorite(p.id, 'product')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="p-3">
                    <Link href={`/product/${p.id}`}><p className="line-clamp-1 text-sm font-semibold hover:text-primary">{p.name}</p></Link>
                    <p className="text-xs text-muted-foreground">{p.brand?.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{formatINR(getEffectivePrice(p.price, p.discount_price))}</span>
                      <Badge variant={p.stock_status === 'in_stock' ? 'default' : 'secondary'} className="text-xs">{p.stock_status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/product/${p.id}`} className="flex-1"><Button size="sm" variant="outline" className="w-full">View</Button></Link>
                      <Link href={`/compare?ids=${p.id}`}><Button size="sm" variant="ghost">Compare</Button></Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Heart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No saved products yet. Browse products and tap the heart icon to save them.</p>
              <Link href="/search" className="mt-3 inline-block"><Button variant="outline">Browse Products</Button></Link>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dealers" className="mt-4">
          {dealers.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dealers.map((d) => (
                <Card key={d.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {d.logo_url && <img src={d.logo_url} alt={d.shop_name} className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <Link href={`/dealer/${d.id}`}><p className="text-sm font-semibold hover:text-primary">{d.shop_name}</p></Link>
                      <p className="text-xs text-muted-foreground">{d.city}, {d.state}</p>
                      <div className="mt-1 flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" /><span className="text-xs">{d.rating.toFixed(1)} ({d.rating_count})</span></div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeFavorite(d.id, 'dealer')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <Link href={`/dealer/${d.id}`} className="mt-3 block"><Button size="sm" variant="outline" className="w-full">View Dealer</Button></Link>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No favorite dealers yet. Discover dealers near you.</p>
              <Link href="/nearby" className="mt-3 inline-block"><Button variant="outline">Find Nearby Dealers</Button></Link>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
