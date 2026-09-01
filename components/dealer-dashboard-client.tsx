'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Store, LayoutDashboard, Package, BarChart3, Settings, Plus, Edit, Trash2,
  TrendingUp, Eye, ShoppingCart, Star, AlertTriangle, Sparkles, Zap, X,
  Check, Image as ImageIcon, DollarSign, Clock, Search, Filter, LogIn, Shield,
  MessageSquare, Users, Send, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase, type Product, type Dealer, type Category, type Brand } from '@/lib/supabase';
import { fetchCategories, fetchBrands } from '@/lib/data';
import { formatINR, getEffectivePrice, getDiscountPercent, formatCompact } from '@/lib/format';
import { aiAnalyzeImage, aiSuggestPrice, aiDemandPrediction, type AiImageResult } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { DealerModerationClient } from '@/components/dealer-moderation-client';
import { DealerCatalogClient } from '@/components/dealer-catalog-client';
import { fetchDealerConversations, fetchMessages, sendMessage, markMessagesRead } from '@/lib/messaging';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';

const stockStatuses = [
  { value: 'in_stock', label: 'In Stock', color: 'text-success' },
  { value: 'limited', label: 'Limited Stock', color: 'text-warning' },
  { value: 'out_of_stock', label: 'Out of Stock', color: 'text-destructive' },
  { value: 'restocking', label: 'Restocking Soon', color: 'text-muted-foreground' },
];

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function DealerDashboardClient() {
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [search, setSearch] = useState('');
  const { role, dealer: authDealer, loading: authLoading } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const [cats, brnds] = await Promise.all([
          fetchCategories(),
          fetchBrands(),
        ]);
        setCategories(cats);
        setBrands(brnds);
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDealerId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: d } = await supabase.from('dealers').select('*, category:business_category_id(*)').eq('id', selectedDealerId).maybeSingle();
        setDealer(d);
        const { data: prods } = await supabase
          .from('products')
          .select('*, dealer:dealer_id(*), category:category_id(*), brand:brand_id(*)')
          .eq('dealer_id', selectedDealerId)
          .order('created_at', { ascending: false });
        setProducts(prods ?? []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [selectedDealerId]);

  useEffect(() => {
    if (authDealer?.id) setSelectedDealerId(authDealer.id);
  }, [authDealer]);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    return products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const analytics = useMemo(() => {
    const totalViews = products.reduce((a, p) => a + p.view_count, 0);
    const totalSearch = products.reduce((a, p) => a + p.search_count, 0);
    const inStock = products.filter((p) => p.stock_status === 'in_stock').length;
    const lowStock = products.filter((p) => p.stock_status === 'limited' || (p.stock_qty > 0 && p.stock_qty <= 5)).length;
    const outStock = products.filter((p) => p.stock_status === 'out_of_stock').length;
    const totalValue = products.reduce((a, p) => a + getEffectivePrice(p.price, p.discount_price) * p.stock_qty, 0);
    const avgPrice = products.length > 0 ? products.reduce((a, p) => a + getEffectivePrice(p.price, p.discount_price), 0) / products.length : 0;
    const topProducts = [...products].sort((a, b) => b.view_count - a.view_count).slice(0, 5);
    const categoryDist: Record<string, number> = {};
    products.forEach((p) => { const c = p.category?.name ?? 'Other'; categoryDist[c] = (categoryDist[c] ?? 0) + 1; });
    const categoryData = Object.entries(categoryDist).map(([name, value]) => ({ name, value }));
    const viewsData = products.slice(0, 7).map((p) => ({ name: p.name.slice(0, 15), views: p.view_count, searches: p.search_count }));
    return { totalViews, totalSearch, inStock, lowStock, outStock, totalValue, avgPrice, topProducts, categoryData, viewsData };
  }, [products]);

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Product deleted');
    } catch (e: any) { toast.error('Failed to delete'); }
  };

  const handleStockChange = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('products').update({ stock_status: status }).eq('id', id);
      if (error) throw error;
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, stock_status: status as any } : p));
      toast.success('Stock status updated');
    } catch (e) { toast.error('Update failed'); }
  };

  if (authLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (role !== 'dealer' || !authDealer) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Store className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Dealer Login Required</h2>
        <p className="mt-2 text-sm text-muted-foreground">You need to sign in as a dealer to access the dashboard.</p>
        <Link href="/dealer/login">
          <Button className="mt-4"><LogIn className="mr-2 h-4 w-4" /> Go to Dealer Login</Button>
        </Link>
      </div>
    );
  }

  if (loading && !dealer) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Store className="h-6 w-6 text-primary" /> Dealer Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your shop inventory, view analytics, and grow your business</p>
        </div>
        <div className="flex items-center gap-2">
          {authDealer && <Badge variant="secondary" className="gap-1.5"><Store className="h-3.5 w-3.5" /> {authDealer.shop_name}</Badge>}
        </div>
      </div>

      {dealer && (
        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview"><LayoutDashboard className="mr-1.5 h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="products"><Package className="mr-1.5 h-4 w-4" /> Products ({products.length})</TabsTrigger>
            <TabsTrigger value="catalog"><ShoppingCart className="mr-1.5 h-4 w-4" /> Add Products</TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="mr-1.5 h-4 w-4" /> Analytics</TabsTrigger>
            <TabsTrigger value="ai"><Sparkles className="mr-1.5 h-4 w-4" /> AI Insights</TabsTrigger>
            <TabsTrigger value="moderation"><Shield className="mr-1.5 h-4 w-4" /> Moderation</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="mr-1.5 h-4 w-4" /> Messages</TabsTrigger>
            <TabsTrigger value="enquiries"><Users className="mr-1.5 h-4 w-4" /> Enquiries</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="mr-1.5 h-4 w-4" /> Profile</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={Package} label="Total Products" value={String(products.length)} color="primary" />
              <StatCard icon={Eye} label="Total Views" value={formatCompact(analytics.totalViews)} color="accent" />
              <StatCard icon={DollarSign} label="Inventory Value" value={formatINR(analytics.totalValue)} color="success" />
              <StatCard icon={Star} label="Shop Rating" value={dealer.rating.toFixed(1)} color="warning" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={Check} label="In Stock" value={String(analytics.inStock)} color="success" />
              <StatCard icon={AlertTriangle} label="Low Stock" value={String(analytics.lowStock)} color="warning" />
              <StatCard icon={X} label="Out of Stock" value={String(analytics.outStock)} color="destructive" />
              <StatCard icon={TrendingUp} label="Avg Price" value={formatINR(Math.round(analytics.avgPrice))} color="primary" />
            </div>

            {/* Low stock alerts */}
            {analytics.lowStock > 0 && (
              <Card className="border-warning/40 bg-warning/5 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <h3 className="font-semibold text-warning">Low Stock Alerts</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {products.filter((p) => p.stock_status === 'limited' || (p.stock_qty > 0 && p.stock_qty <= 5)).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <div className="relative h-8 w-8 overflow-hidden rounded bg-muted">
                          {p.images[0] && <Image src={p.images[0]} alt={p.name} fill sizes="32px" className="object-cover" />}
                        </div>
                        {p.name}
                      </span>
                      <Badge variant="secondary" className="text-warning">{p.stock_qty} left</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Top products */}
            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Top Viewed Products</h3>
              <div className="space-y-2">
                {analytics.topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <div className="relative h-10 w-10 overflow-hidden rounded bg-muted">
                      {p.images[0] && <Image src={p.images[0]} alt={p.name} fill sizes="40px" className="object-cover" />}
                    </div>
                    <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground"><Eye className="h-3.5 w-3.5" /> {formatCompact(p.view_count)}</span>
                    <span className="text-sm font-semibold">{formatINR(getEffectivePrice(p.price, p.discount_price))}</span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* PRODUCTS */}
          <TabsContent value="products" className="mt-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
              </div>
              <Button onClick={() => { setEditProduct(null); setShowProductDialog(true); }}>
                <Plus className="mr-1 h-4 w-4" /> Add Product
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Product</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Price</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Stock</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Views</th>
                    <th className="px-3 py-2.5 text-left font-semibold">AI</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            {p.images[0] && <Image src={p.images[0]} alt={p.name} fill sizes="40px" className="object-cover" />}
                          </div>
                          <div>
                            <p className="line-clamp-1 font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category?.name} · {p.brand?.name ?? 'No brand'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold">{formatINR(getEffectivePrice(p.price, p.discount_price))}</span>
                        {p.discount_price && <p className="text-xs text-muted-foreground line-through">{formatINR(p.price)}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Select value={p.stock_status} onValueChange={(v) => handleStockChange(p.id, v)}>
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stockStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.stock_qty} units</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatCompact(p.view_count)}</td>
                      <td className="px-3 py-2.5">{p.ai_verified && <Badge className="bg-accent/15 text-accent text-[10px]"><Sparkles className="mr-0.5 h-2.5 w-2.5" /> AI</Badge>}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditProduct(p); setShowProductDialog(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No products yet. Click "Add Product" to create your first listing.</div>}
            </div>
          </TabsContent>

          {/* MASTER CATALOG SELECTION */}
          <TabsContent value="catalog" className="mt-4">
            <DealerCatalogClient dealer={dealer} />
          </TabsContent>

          {/* ANALYTICS */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold">Product Views & Searches</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.viewsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                    <Bar dataKey="views" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="searches" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold">Category Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={analytics.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                      {analytics.categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold">Inventory Value Trend (Simulated)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={[
                  { day: 'Mon', value: analytics.totalValue * 0.85 },
                  { day: 'Tue', value: analytics.totalValue * 0.9 },
                  { day: 'Wed', value: analytics.totalValue * 0.88 },
                  { day: 'Thu', value: analytics.totalValue * 0.95 },
                  { day: 'Fri', value: analytics.totalValue * 0.92 },
                  { day: 'Sat', value: analytics.totalValue },
                  { day: 'Sun', value: analytics.totalValue * 1.02 },
                ]}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${formatCompact(v)}`} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v: number) => formatINR(v)} />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" fill="url(#colorValue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* AI INSIGHTS */}
          <TabsContent value="ai" className="mt-4 space-y-4">
            <Card className="border-accent/30 bg-accent/5 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <h3 className="font-semibold text-accent">AI Demand Prediction</h3>
              </div>
              <p className="mt-2 text-sm">{dealer.category ? aiDemandPrediction(dealer.category.slug) : aiDemandPrediction('')}</p>
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><DollarSign className="h-4 w-4 text-success" /> Dynamic Pricing Suggestions</h3>
              <div className="space-y-3">
                {products.filter((p) => p.stock_status !== 'out_of_stock').slice(0, 4).map((p) => {
                  const similarPrices = products.filter((x) => x.name === p.name && x.id !== p.id).map((x) => getEffectivePrice(x.price, x.discount_price));
                  const allPrices = [getEffectivePrice(p.price, p.discount_price), ...similarPrices];
                  const suggestion = aiSuggestPrice(allPrices);
                  return (
                    <div key={p.id} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-sm">Current: <span className="font-semibold">{formatINR(getEffectivePrice(p.price, p.discount_price))}</span></span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-muted/50 p-2"><p className="text-muted-foreground">Market Min</p><p className="font-semibold text-success">{formatINR(suggestion.min)}</p></div>
                        <div className="rounded bg-muted/50 p-2"><p className="text-muted-foreground">Market Avg</p><p className="font-semibold">{formatINR(Math.round(suggestion.avg))}</p></div>
                        <div className="rounded bg-primary/10 p-2"><p className="text-primary">AI Suggested</p><p className="font-bold text-primary">{formatINR(suggestion.suggested)}</p></div>
                      </div>
                    </div>
                  );
                })}
                {products.length === 0 && <p className="text-sm text-muted-foreground">Add products to get AI pricing suggestions.</p>}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-warning" /> Fast-Moving Products</h3>
              <div className="space-y-2">
                {[...products].sort((a, b) => b.search_count - a.search_count).slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <Badge variant="secondary">{formatCompact(p.search_count)} searches</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* MODERATION */}
          <TabsContent value="moderation" className="mt-4">
            <DealerModerationClient dealer={dealer} />
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="mt-4">
            <DealerMessagesTab dealerId={dealer.id} />
          </TabsContent>

          {/* ENQUIRIES */}
          <TabsContent value="enquiries" className="mt-4">
            <DealerEnquiriesTab dealerId={dealer.id} />
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-4">
            <Card className="p-6">
              <h3 className="mb-4 text-base font-semibold">Shop Profile</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-sm">Shop Name</Label>
                  <Input defaultValue={dealer.shop_name} readOnly />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Owner Name</Label>
                  <Input defaultValue={dealer.owner_name} readOnly />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Email</Label>
                  <Input defaultValue={dealer.email} readOnly />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Phone</Label>
                  <Input defaultValue={dealer.phone} readOnly />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-sm">Address</Label>
                  <Input defaultValue={`${dealer.address}, ${dealer.city}, ${dealer.state} - ${dealer.pin_code}`} readOnly />
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Profile editing requires admin verification. Contact support to update shop details.</p>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Product Dialog */}
      {showProductDialog && dealer && (
        <ProductFormDialog
          open={showProductDialog}
          onOpenChange={setShowProductDialog}
          product={editProduct}
          dealerId={dealer.id}
          categories={categories}
          brands={brands}
          onSave={(saved) => {
            if (editProduct) {
              setProducts((prev) => prev.map((p) => p.id === saved.id ? saved : p));
            } else {
              setProducts((prev) => [saved, ...prev]);
            }
            setShowProductDialog(false);
          }}
        />
      )}
    </div>
  );
}

// Dealer Messages tab — chat with customers
function DealerMessagesTab({ dealerId }: { dealerId: string }) {
  const [conversations, setConversations] = useState<{ customerId: string; lastMessage: any; unreadCount: number; customerLabel: string }[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const convos = await fetchDealerConversations(dealerId);
        setConversations(convos);
      } catch { toast.error('Failed to load conversations'); }
      finally { setLoading(false); }
    })();
  }, [dealerId]);

  useEffect(() => {
    if (!activeCustomer) return;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('dealer_id', dealerId)
          .eq('customer_id', activeCustomer)
          .order('created_at', { ascending: true });
        setMessages(data ?? []);
        await markMessagesRead(dealerId);
      } catch { toast.error('Failed to load messages'); }
    })();
  }, [activeCustomer, dealerId]);

  const handleSend = async () => {
    if (!input.trim() || !activeCustomer) return;
    setSending(true);
    try {
      const msg = await sendMessage(dealerId, input.trim(), null, null, 'dealer');
      if (msg) { setMessages((prev) => [...prev, msg]); setInput(''); }
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  if (loading) return <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  if (conversations.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">No messages yet</p>
        <p className="text-sm text-muted-foreground">Customer enquiries will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        {conversations.map((c) => (
          <button
            key={c.customerId}
            onClick={() => setActiveCustomer(c.customerId)}
            className={cn('flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm', activeCustomer === c.customerId ? 'border-primary bg-primary/5' : 'border-border/60')}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{c.customerLabel[0]}</div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{c.customerLabel}</p>
              <p className="truncate text-xs text-muted-foreground">{c.lastMessage.body}</p>
            </div>
            {c.unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{c.unreadCount}</Badge>}
          </button>
        ))}
      </div>
      <div className="flex flex-col rounded-xl border border-border/60">
        {activeCustomer ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '50vh' }}>
              {messages.map((msg) => (
                <div key={msg.id} className={cn('flex', msg.sender_type === 'dealer' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-sm', msg.sender_type === 'dealer' ? 'blue-gradient text-white' : 'bg-muted')}>
                    {msg.image_url && <img src={msg.image_url} alt="" className="mb-2 max-h-32 rounded-lg" />}
                    <p>{msg.body}</p>
                    <p className={cn('mt-1 text-[10px]', msg.sender_type === 'dealer' ? 'text-white/60' : 'text-muted-foreground')}>
                      {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 p-3">
              <div className="flex items-end gap-2">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Reply to customer..." className="min-h-[40px] max-h-24 flex-1 resize-none text-sm" rows={1} />
                <Button onClick={handleSend} disabled={sending || !input.trim()} className="shrink-0 blue-gradient text-white hover:opacity-90">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground">
            <div><MessageSquare className="mx-auto mb-2 h-8 w-8" /><p className="text-sm">Select a conversation</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

// Dealer Enquiries tab — customer enquiry stats
function DealerEnquiriesTab({ dealerId }: { dealerId: string }) {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase.from('messages').select('*').eq('dealer_id', dealerId).eq('sender_type', 'customer').order('created_at', { ascending: false }).limit(20);
        setEnquiries(data ?? []);
      } catch { toast.error('Failed to load enquiries'); }
      finally { setLoading(false); }
    })();
  }, [dealerId]);

  if (loading) return <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  const uniqueCustomers = new Set(enquiries.map((e) => e.customer_id)).size;
  const unreadCount = enquiries.filter((e) => !e.is_read).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Unique Customers" value={String(uniqueCustomers)} color="primary" />
        <StatCard icon={MessageSquare} label="Total Enquiries" value={String(enquiries.length)} color="accent" />
        <StatCard icon={Eye} label="Unread" value={String(unreadCount)} color="warning" />
      </div>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Recent Customer Enquiries</h3>
        {enquiries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No customer enquiries yet.</p>
        ) : (
          <div className="space-y-2">
            {enquiries.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{e.customer_id.slice(-2).toUpperCase()}</div>
                <div className="flex-1">
                  <p className="text-sm">{e.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('en-IN')}</p>
                </div>
                {!e.is_read && <Badge className="bg-primary/15 text-primary">New</Badge>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };
  return (
    <Card className="p-4">
      <div className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-lg', colors[color])}><Icon className="h-5 w-5" /></div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </Card>
  );
}

// Product form dialog with AI image detection
function ProductFormDialog({ open, onOpenChange, product, dealerId, categories, brands, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
  dealerId: string;
  categories: Category[];
  brands: Brand[];
  onSave: (p: Product) => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    slug: '',
    brand_id: product?.brand_id ?? '',
    category_id: product?.category_id ?? '',
    model: product?.model ?? '',
    sku: product?.sku ?? '',
    description: product?.description ?? '',
    price: product?.price?.toString() ?? '',
    discount_price: product?.discount_price?.toString() ?? '',
    stock_qty: product?.stock_qty?.toString() ?? '0',
    stock_status: product?.stock_status ?? 'in_stock',
    color: product?.color ?? '',
    size: product?.size ?? '',
    material: product?.material ?? '',
    warranty: product?.warranty ?? '',
    delivery_available: product?.delivery_available ?? true,
    pickup_available: product?.pickup_available ?? true,
    tags: (product?.tags ?? []).join(', '),
    images: (product?.images ?? []).join(', '),
    is_featured: product?.is_featured ?? false,
    is_trending: product?.is_trending ?? false,
  });
  const [aiResult, setAiResult] = useState<AiImageResult | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleAiAnalyze = () => {
    const firstImage = form.images.split(',')[0]?.trim();
    if (!firstImage) { toast.error('Add at least one image URL first'); return; }
    setAiAnalyzing(true);
    setTimeout(() => {
      const result = aiAnalyzeImage(firstImage, form.name);
      setAiResult(result);
      setAiAnalyzing(false);
      // Auto-fill some fields
      if (!form.description && result.generatedDescription) handleChange('description', result.generatedDescription);
      if (!form.tags && result.generatedTags.length) handleChange('tags', result.generatedTags.join(', '));
      if (!form.color && result.detectedColor) handleChange('color', result.detectedColor);
      if (!form.category_id && result.detectedCategory) {
        const cat = categories.find((c) => c.name === result.detectedCategory);
        if (cat) handleChange('category_id', cat.id);
      }
      toast.success(`AI analyzed image (${(result.confidence * 100).toFixed(0)}% confidence)`);
    }, 1200);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error('Name and price are required'); return; }
    setSaving(true);
    try {
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
      const images = form.images.split(',').map((s) => s.trim()).filter(Boolean);
      const tags = form.tags.split(',').map((s) => s.trim()).filter(Boolean);
      const payload = {
        dealer_id: dealerId,
        name: form.name,
        slug,
        brand_id: form.brand_id || null,
        category_id: form.category_id || null,
        model: form.model || null,
        sku: form.sku || null,
        description: form.description || null,
        price: parseFloat(form.price),
        discount_price: form.discount_price ? parseFloat(form.discount_price) : null,
        stock_qty: parseInt(form.stock_qty) || 0,
        stock_status: form.stock_status,
        color: form.color || null,
        size: form.size || null,
        material: form.material || null,
        warranty: form.warranty || null,
        delivery_available: form.delivery_available,
        pickup_available: form.pickup_available,
        tags,
        images,
        is_featured: form.is_featured,
        is_trending: form.is_trending,
        ai_verified: !!aiResult,
        ai_description: aiResult?.generatedDescription ?? null,
        ai_tags: aiResult?.generatedTags ?? [],
        specifications: {},
        features: [],
      };
      if (product) {
        const { data, error } = await supabase.from('products').update(payload).eq('id', product.id).select('*, dealer:dealer_id(*), category:category_id(*), brand:brand_id(*)').single();
        if (error) throw error;
        onSave(data);
        toast.success('Product updated');
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select('*, dealer:dealer_id(*), category:category_id(*), brand:brand_id(*)').single();
        if (error) throw error;
        onSave(data);
        toast.success('Product added');
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* AI image analysis */}
          <Card className="border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-accent">AI Image Detection</p>
                  <p className="text-xs text-muted-foreground">Upload an image URL and let AI detect product, brand, and generate descriptions</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleAiAnalyze} disabled={aiAnalyzing}>
                {aiAnalyzing ? 'Analyzing...' : <><ImageIcon className="mr-1 h-3.5 w-3.5" /> Analyze</>}
              </Button>
            </div>
            {aiResult && (
              <div className="mt-3 space-y-2 rounded-lg bg-background/60 p-3 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-accent/15 text-accent">Detected: {aiResult.detectedProduct}</Badge>
                  {aiResult.detectedBrand && <Badge variant="secondary">{aiResult.detectedBrand}</Badge>}
                  {aiResult.detectedColor && <Badge variant="secondary">{aiResult.detectedColor}</Badge>}
                  <Badge variant="outline">Confidence: {(aiResult.confidence * 100).toFixed(0)}%</Badge>
                </div>
                {aiResult.warning && (
                  <div className="flex items-start gap-1.5 rounded bg-warning/10 p-2 text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{aiResult.warning}</span>
                  </div>
                )}
                <p className="text-muted-foreground"><span className="font-medium text-foreground">AI Description:</span> {aiResult.generatedDescription}</p>
                <p className="text-muted-foreground"><span className="font-medium text-foreground">SEO Keywords:</span> {aiResult.seoKeywords.join(', ')}</p>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm">Product Name *</Label>
              <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="e.g. Samsung Galaxy S25 Ultra" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Brand</Label>
              <Select value={form.brand_id} onValueChange={(v) => handleChange('brand_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Category</Label>
              <Select value={form.category_id} onValueChange={(v) => handleChange('category_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Price (₹) *</Label>
              <Input type="number" value={form.price} onChange={(e) => handleChange('price', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Discount Price (₹)</Label>
              <Input type="number" value={form.discount_price} onChange={(e) => handleChange('discount_price', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Stock Quantity</Label>
              <Input type="number" value={form.stock_qty} onChange={(e) => handleChange('stock_qty', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Stock Status</Label>
              <Select value={form.stock_status} onValueChange={(v) => handleChange('stock_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{stockStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Color</Label>
              <Input value={form.color} onChange={(e) => handleChange('color', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Size</Label>
              <Input value={form.size} onChange={(e) => handleChange('size', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Material</Label>
              <Input value={form.material} onChange={(e) => handleChange('material', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Warranty</Label>
              <Input value={form.warranty} onChange={(e) => handleChange('warranty', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm">Description</Label>
              <Textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={3} placeholder="Product description" />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm">Image URLs (comma-separated)</Label>
              <Input value={form.images} onChange={(e) => handleChange('images', e.target.value)} placeholder="https://..." />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm">Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e) => handleChange('tags', e.target.value)} placeholder="samsung, mobile, 5g" />
            </div>
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.delivery_available} onChange={(e) => handleChange('delivery_available', e.target.checked)} className="h-4 w-4 rounded" /> Delivery</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pickup_available} onChange={(e) => handleChange('pickup_available', e.target.checked)} className="h-4 w-4 rounded" /> Pickup</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_featured} onChange={(e) => handleChange('is_featured', e.target.checked)} className="h-4 w-4 rounded" /> Featured</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_trending} onChange={(e) => handleChange('is_trending', e.target.checked)} className="h-4 w-4 rounded" /> Trending</label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : product ? 'Update Product' : 'Add Product'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
