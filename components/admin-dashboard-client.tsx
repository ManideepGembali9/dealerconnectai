'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  LayoutDashboard, Store, Package, BarChart3, Shield, Users, TrendingUp,
  Check, X, Eye, Trash2, AlertTriangle, Sparkles, MapPin, Search, Activity,
  Clock, ShoppingBag, DollarSign, Star, Zap, Filter, ChevronRight, UserX, UserCheck, LogIn, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase, type Dealer, type Product, type Category } from '@/lib/supabase';
import { formatINR, getEffectivePrice, formatCompact, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { ModerationQueueClient } from '@/components/moderation-queue-client';
import { AdminCatalogClient } from '@/components/admin-catalog-client';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart, RadialBarChart, RadialBar
} from 'recharts';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function AdminDashboardClient() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchLogs, setSearchLogs] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { role, loading: authLoading } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dls, prods, cats, logs, custCount, revs, modLogs] = await Promise.all([
        supabase.from('dealers').select('*, category:business_category_id(*)').order('created_at', { ascending: false }),
        supabase.from('products').select('*, dealer:dealer_id(*), category:category_id(*), brand:brand_id(*)').order('created_at', { ascending: false }).limit(100),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('search_logs').select('*, category:category_id(*)').order('created_at', { ascending: false }).limit(100),
        supabase.from('customer_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('reviews').select('*, product:product_id(name), dealer:dealer_id(shop_name), customer:customer_id(full_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('moderation_logs').select('*, product:product_id(name)').order('created_at', { ascending: false }).limit(50),
      ]);
      setDealers(dls.data ?? []);
      setProducts(prods.data ?? []);
      setCategories(cats.data ?? []);
      setSearchLogs(logs.data ?? []);
      setCustomerCount(custCount.count ?? 0);
      setReviews(revs.data ?? []);
      setModerationLogs(modLogs.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const totalDealers = dealers.length;
    const approved = dealers.filter((d) => d.status === 'approved').length;
    const pending = dealers.filter((d) => d.status === 'pending').length;
    const suspended = dealers.filter((d) => d.status === 'suspended').length;
    const blocked = dealers.filter((d) => d.status === 'blocked').length;
    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.stock_status !== 'out_of_stock').length;
    const pendingProducts = 0;
    const totalViews = products.reduce((a, p) => a + p.view_count, 0);
    const totalSearches = products.reduce((a, p) => a + p.search_count, 0);
    const trendingProducts = products.filter((p) => p.is_trending).length;
    const aiVerified = products.filter((p) => p.ai_verified).length;
    return { totalDealers, approved, pending, suspended, blocked, totalProducts, activeProducts, pendingProducts, totalViews, totalSearches, trendingProducts, aiVerified };
  }, [dealers, products]);

  const topProducts = useMemo(() => [...products].sort((a, b) => b.view_count - a.view_count).slice(0, 8), [products]);
  const topSearched = useMemo(() => [...products].sort((a, b) => b.search_count - a.search_count).slice(0, 8), [products]);

  const categoryDist = useMemo(() => {
    const dist: Record<string, number> = {};
    products.forEach((p) => { const c = p.category?.name ?? 'Other'; dist[c] = (dist[c] ?? 0) + 1; });
    return Object.entries(dist).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [products]);

  const searchActivity = useMemo(() => {
    const days: Record<string, { searches: number; uniquePins: Set<string> }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      days[key] = { searches: 0, uniquePins: new Set() };
    }
    searchLogs.forEach((l) => {
      if (!l.created_at) return;
      const d = new Date(l.created_at);
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff > 6) return;
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      if (days[key]) {
        days[key].searches++;
        if (l.pin_code) days[key].uniquePins.add(l.pin_code);
      }
    });
    return Object.entries(days).map(([day, v]) => ({ day, searches: v.searches, locations: v.uniquePins.size }));
  }, [searchLogs]);

  const topSearchTerms = useMemo(() => {
    const termCount: Record<string, number> = {};
    searchLogs.forEach((l) => { termCount[l.query] = (termCount[l.query] ?? 0) + 1; });
    return Object.entries(termCount).map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [searchLogs]);

  const pinAnalytics = useMemo(() => {
    const pinCount: Record<string, number> = {};
    searchLogs.forEach((l) => { if (l.pin_code) pinCount[l.pin_code] = (pinCount[l.pin_code] ?? 0) + 1; });
    return Object.entries(pinCount).map(([pin, count]) => ({ pin, count })).sort((a, b) => b.count - a.count);
  }, [searchLogs]);

  const handleDealerStatus = async (id: string, status: Dealer['status']) => {
    try {
      const payload: any = { status };
      if (status === 'approved') payload.approved_at = new Date().toISOString();
      const { error } = await supabase.from('dealers').update(payload).eq('id', id);
      if (error) throw error;
      setDealers((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
      toast.success(`Dealer ${status}`);
    } catch (e) { toast.error('Update failed'); }
  };

  const handleDeleteDealer = async (id: string) => {
    if (!confirm('Delete this dealer? This will also delete all their products.')) return;
    try {
      const { error } = await supabase.from('dealers').delete().eq('id', id);
      if (error) throw error;
      setDealers((prev) => prev.filter((d) => d.id !== id));
      setProducts((prev) => prev.filter((p) => p.dealer_id !== id));
      toast.success('Dealer deleted');
    } catch (e) { toast.error('Delete failed'); }
  };

  const filteredDealers = useMemo(() => {
    let result = dealers;
    if (statusFilter !== 'all') result = result.filter((d) => d.status === statusFilter);
    if (search) result = result.filter((d) => d.shop_name.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase()) || d.pin_code.includes(search));
    return result;
  }, [dealers, statusFilter, search]);

  if (authLoading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (role !== 'admin') {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Admin Login Required</h2>
        <p className="mt-2 text-sm text-muted-foreground">You need to sign in as an admin to access this dashboard.</p>
        <Link href="/admin/login">
          <Button className="mt-4"><LogIn className="mr-2 h-4 w-4" /> Go to Admin Login</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Shield className="h-6 w-6 text-primary" /> Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform oversight, dealer approvals, analytics, and content moderation</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview"><LayoutDashboard className="mr-1.5 h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="dealers"><Store className="mr-1.5 h-4 w-4" /> Dealers <Badge className="ml-1 bg-destructive/15 text-destructive">{stats.pending}</Badge></TabsTrigger>
          <TabsTrigger value="products"><Package className="mr-1.5 h-4 w-4" /> Products</TabsTrigger>
          <TabsTrigger value="catalog"><Package className="mr-1.5 h-4 w-4" /> Master Catalog</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1.5 h-4 w-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="reports"><Activity className="mr-1.5 h-4 w-4" /> Reports</TabsTrigger>
          <TabsTrigger value="reviews"><Star className="mr-1.5 h-4 w-4" /> Reviews</TabsTrigger>
          <TabsTrigger value="ai-activity"><Sparkles className="mr-1.5 h-4 w-4" /> AI Activity</TabsTrigger>
          <TabsTrigger value="moderation"><Shield className="mr-1.5 h-4 w-4" /> AI Moderation</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={Users} label="Total Users" value={formatCompact(customerCount)} color="primary" />
            <StatCard icon={Store} label="Total Dealers" value={String(stats.totalDealers)} color="accent" />
            <StatCard icon={Clock} label="Pending" value={String(stats.pending)} color="warning" />
            <StatCard icon={Check} label="Approved" value={String(stats.approved)} color="success" />
            <StatCard icon={Package} label="Products" value={String(stats.totalProducts)} color="primary" />
            <StatCard icon={Search} label="Searches (30d)" value={String(searchLogs.length)} color="accent" />
          </div>

          {/* Growth charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Search Activity (7 days)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={searchActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="searches" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="locations" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4 text-primary" /> Products by Category</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={categoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                    {categoryDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Top viewed + searched */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4 text-primary" /> Most Viewed Products</h3>
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-muted-foreground">{formatCompact(p.view_count)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Search className="h-4 w-4 text-primary" /> Most Searched Products</h3>
              <div className="space-y-2">
                {topSearched.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-muted-foreground">{formatCompact(p.search_count)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Platform health */}
          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-success" /> Platform Health</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HealthBar label="Server Status" value="Healthy" percent={98} color="success" />
              <HealthBar label="AI Services" value="Online" percent={95} color="success" />
              <HealthBar label="Database" value="Optimal" percent={92} color="primary" />
              <HealthBar label="Search Index" value="Updated" percent={88} color="accent" />
            </div>
          </Card>
        </TabsContent>

        {/* DEALERS */}
        <TabsContent value="dealers" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, PIN..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pending approval cards */}
          {statusFilter === 'all' && stats.pending > 0 && (
            <Card className="mb-4 border-warning/40 bg-warning/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-warning"><AlertTriangle className="h-5 w-5" /> Pending Approvals ({stats.pending})</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {dealers.filter((d) => d.status === 'pending').map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg bg-background/60 p-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-muted">
                      {d.logo_url && <Image src={d.logo_url} alt={d.shop_name} fill sizes="48px" className="object-cover" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{d.shop_name}</p>
                      <p className="text-xs text-muted-foreground">{d.owner_name} · {d.city}, {d.state}</p>
                      <p className="text-xs text-muted-foreground">{d.category?.name}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-8 bg-success hover:bg-success/90" onClick={() => handleDealerStatus(d.id, 'approved')}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => handleDealerStatus(d.id, 'blocked')}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Shop</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Category</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Location</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Products</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Rating</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDealers.map((d) => (
                  <tr key={d.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <Link href={`/dealer/${d.id}`} className="flex items-center gap-2 hover:text-primary">
                        <div className="relative h-9 w-9 overflow-hidden rounded bg-muted">{d.logo_url && <Image src={d.logo_url} alt={d.shop_name} fill sizes="36px" className="object-cover" />}</div>
                        <div><p className="font-medium">{d.shop_name}</p><p className="text-xs text-muted-foreground">{d.owner_name}</p></div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{d.category?.name ?? '—'}</td>
                    <td className="px-3 py-2.5"><p>{d.city}, {d.state}</p><p className="text-xs text-muted-foreground">{d.pin_code}</p></td>
                    <td className="px-3 py-2.5">{d.product_count}</td>
                    <td className="px-3 py-2.5"><span className="flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{d.rating.toFixed(1)}</span></td>
                    <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {d.status === 'pending' && (
                          <Button size="sm" variant="ghost" className="h-8 text-success hover:bg-success/10" onClick={() => handleDealerStatus(d.id, 'approved')} title="Approve"><UserCheck className="h-4 w-4" /></Button>
                        )}
                        {d.status === 'approved' && (
                          <Button size="sm" variant="ghost" className="h-8 text-warning hover:bg-warning/10" onClick={() => handleDealerStatus(d.id, 'suspended')} title="Suspend"><UserX className="h-4 w-4" /></Button>
                        )}
                        {d.status === 'suspended' && (
                          <Button size="sm" variant="ghost" className="h-8 text-success hover:bg-success/10" onClick={() => handleDealerStatus(d.id, 'approved')} title="Reactivate"><UserCheck className="h-4 w-4" /></Button>
                        )}
                        {d.status !== 'blocked' && (
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => handleDealerStatus(d.id, 'blocked')} title="Block"><X className="h-4 w-4" /></Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDealer(d.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* PRODUCTS */}
        <TabsContent value="products" className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Package} label="Total Products" value={String(stats.totalProducts)} color="primary" />
            <StatCard icon={Check} label="Active" value={String(stats.activeProducts)} color="success" />
            <StatCard icon={Zap} label="Trending" value={String(stats.trendingProducts)} color="warning" />
            <StatCard icon={Sparkles} label="AI Verified" value={String(stats.aiVerified)} color="accent" />
          </div>
          <Card className="mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Product</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Dealer</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Price</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Stock</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Views</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 20).map((p) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <Link href={`/product/${p.id}`} className="flex items-center gap-2 hover:text-primary">
                          <div className="relative h-9 w-9 overflow-hidden rounded bg-muted">{p.images[0] && <Image src={p.images[0]} alt={p.name} fill sizes="36px" className="object-cover" />}</div>
                          <div><p className="line-clamp-1 font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category?.name}</p></div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.dealer?.shop_name ?? '—'}</td>
                      <td className="px-3 py-2.5 font-semibold">{formatINR(getEffectivePrice(p.price, p.discount_price))}</td>
                      <td className="px-3 py-2.5"><span className={cn(p.stock_status === 'in_stock' ? 'text-success' : p.stock_status === 'limited' ? 'text-warning' : 'text-destructive')}>{p.stock_qty}</span></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatCompact(p.view_count)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          {p.is_featured && <Badge variant="secondary" className="text-[10px]">Featured</Badge>}
                          {p.is_trending && <Badge className="bg-warning/15 text-warning text-[10px]">Trending</Badge>}
                          {p.ai_verified && <Badge className="bg-accent/15 text-accent text-[10px]"><Sparkles className="mr-0.5 h-2.5 w-2.5" /> AI</Badge>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* MASTER CATALOG */}
        <TabsContent value="catalog" className="mt-4">
          <AdminCatalogClient />
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Search className="h-4 w-4 text-primary" /> Top Search Terms</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topSearchTerms} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="term" tick={{ fontSize: 10 }} width={80} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" /> PIN Code Analytics</h3>
              <div className="space-y-2">
                {pinAnalytics.map((p) => (
                  <div key={p.pin} className="flex items-center gap-3">
                    <Badge variant="secondary">{p.pin}</Badge>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(p.count / pinAnalytics[0].count) * 100}%` }} />
                    </div>
                    <span className="text-sm text-muted-foreground">{p.count} searches</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-primary" /> Search & Location Activity (7 days)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={searchActivity}>
                <defs>
                  <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} /></linearGradient>
                  <linearGradient id="colorSearch" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Area type="monotone" dataKey="searches" stroke="hsl(var(--chart-1))" fill="url(#colorVis)" strokeWidth={2} />
                <Area type="monotone" dataKey="locations" stroke="hsl(var(--chart-2))" fill="url(#colorSearch)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports" className="mt-4">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard icon={AlertTriangle} label="Moderation Actions" value={String(moderationLogs.length)} color="warning" />
              <StatCard icon={Shield} label="Auto-Flagged" value={String(moderationLogs.filter((l) => l.action === 'auto_flag').length)} color="destructive" />
              <StatCard icon={Check} label="Approved" value={String(moderationLogs.filter((l) => l.action === 'approved').length)} color="success" />
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">Product</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Action</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Reason</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moderationLogs.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No moderation actions logged yet.</td></tr>
                    ) : moderationLogs.slice(0, 20).map((l) => (
                      <tr key={l.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2.5 truncate max-w-[200px]">{l.product?.name ?? '—'}</td>
                        <td className="px-3 py-2.5"><Badge className={cn(l.action === 'approved' ? 'bg-success/15 text-success' : l.action === 'rejected' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning')}>{l.action}</Badge></td>
                        <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[200px]">{l.reason ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{l.created_at ? timeAgo(l.created_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* REVIEWS */}
        <TabsContent value="reviews" className="mt-4">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={Star} label="Total Reviews" value={String(reviews.length)} color="primary" />
              <StatCard icon={Check} label="Avg Rating" value={reviews.length > 0 ? (reviews.reduce((a: number, r: any) => a + (r.rating ?? 0), 0) / reviews.length).toFixed(1) : '—'} color="success" />
              <StatCard icon={AlertTriangle} label="Pending Review" value={String(reviews.filter((r: any) => !r.is_approved).length)} color="warning" />
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">Product</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Customer</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Rating</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Comment</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No reviews submitted yet.</td></tr>
                    ) : reviews.slice(0, 20).map((r: any) => (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2.5 truncate max-w-[160px]">{r.product?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.customer?.full_name ?? 'Anonymous'}</td>
                        <td className="px-3 py-2.5"><span className="flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{r.rating}</span></td>
                        <td className="px-3 py-2.5 truncate max-w-[200px] text-muted-foreground">{r.comment ?? '—'}</td>
                        <td className="px-3 py-2.5"><Badge className={r.is_approved ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}>{r.is_approved ? 'Approved' : 'Pending'}</Badge></td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-1">
                            {!r.is_approved && <Button size="sm" variant="ghost" className="h-8 text-success hover:bg-success/10" onClick={async () => { await supabase.from('reviews').update({ is_approved: true }).eq('id', r.id); setReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, is_approved: true } : x)); toast.success('Review approved'); }} title="Approve"><Check className="h-4 w-4" /></Button>}
                            {r.is_approved && <Button size="sm" variant="ghost" className="h-8 text-warning hover:bg-warning/10" onClick={async () => { await supabase.from('reviews').update({ is_approved: false }).eq('id', r.id); setReviews((prev) => prev.map((x) => x.id === r.id ? { ...x, is_approved: false } : x)); }} title="Unapprove"><X className="h-4 w-4" /></Button>}
                            <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" onClick={async () => { await supabase.from('reviews').delete().eq('id', r.id); setReviews((prev) => prev.filter((x) => x.id !== r.id)); toast.success('Review deleted'); }} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* AI ACTIVITY */}
        <TabsContent value="ai-activity" className="mt-4">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Sparkles} label="AI Searches" value={String(searchLogs.filter((l) => l.search_type === 'ai').length)} color="primary" />
              <StatCard icon={Camera} label="Image Searches" value={String(searchLogs.filter((l) => l.search_type === 'image').length)} color="accent" />
              <StatCard icon={Package} label="AI Verified Products" value={String(stats.aiVerified)} color="success" />
              <StatCard icon={Shield} label="Mod. Actions" value={String(moderationLogs.length)} color="warning" />
            </div>
            <Card className="p-6">
              <h3 className="mb-3 text-sm font-semibold">AI Feature Usage</h3>
              <div className="space-y-3">
                <HealthBar label="Natural Language Search" value={String(searchLogs.filter((l) => l.search_type === 'ai').length)} percent={Math.min(100, (searchLogs.filter((l) => l.search_type === 'ai').length / Math.max(1, searchLogs.length)) * 100)} color="primary" />
                <HealthBar label="Image Recognition" value={String(searchLogs.filter((l) => l.search_type === 'image').length)} percent={Math.min(100, (searchLogs.filter((l) => l.search_type === 'image').length / Math.max(1, searchLogs.length)) * 100)} color="accent" />
                <HealthBar label="AI Verified Products" value={String(stats.aiVerified)} percent={Math.min(100, (stats.aiVerified / Math.max(1, stats.totalProducts)) * 100)} color="success" />
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* AI MODERATION */}
        <TabsContent value="moderation" className="mt-4">
          <ModerationQueueClient />
        </TabsContent>
      </Tabs>
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

function StatusBadge({ status }: { status: Dealer['status'] }) {
  const config: Record<string, { className: string; label: string }> = {
    approved: { className: 'bg-success/15 text-success', label: 'Approved' },
    pending: { className: 'bg-warning/15 text-warning', label: 'Pending' },
    suspended: { className: 'bg-destructive/15 text-destructive', label: 'Suspended' },
    blocked: { className: 'bg-destructive/15 text-destructive', label: 'Blocked' },
  };
  const c = config[status] ?? config.pending;
  return <Badge className={c.className}>{c.label}</Badge>;
}

function HealthBar({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  const colors: Record<string, string> = { success: 'bg-success', primary: 'bg-primary', accent: 'bg-accent' };
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', colors[color])} style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
