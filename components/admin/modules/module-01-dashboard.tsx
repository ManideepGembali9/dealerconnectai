'use client';

import { useMemo } from 'react';
import {
  Users, Store, Clock, CheckCircle2, Package, FolderTree, AlertTriangle,
  TrendingUp, MessageSquare, Shield, Sparkles, Eye, ArrowUpRight, Plus,
  Bell, PanelsTopLeft, Sliders
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Dealer, Product, Category, Review, Enquiry, PushNotification } from '@/lib/types';
import { formatCompact, formatINR, timeAgo } from '@/lib/format';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1'];

type Module01Props = {
  dealers: Dealer[];
  products: Product[];
  categories: Category[];
  customerCount: number;
  reviews: Review[];
  enquiries: Enquiry[];
  searchLogs: any[];
  onNavigateTab: (tabId: string) => void;
  onOpenLayoutManager: () => void;
};

export function Module01Dashboard({
  dealers,
  products,
  categories,
  customerCount,
  reviews,
  enquiries,
  searchLogs,
  onNavigateTab,
  onOpenLayoutManager,
}: Module01Props) {
  const stats = useMemo(() => {
    const totalDealers = dealers.length;
    const approvedDealers = dealers.filter((d) => d.status === 'approved').length;
    const pendingDealers = dealers.filter((d) => d.status === 'pending').length;
    const suspendedDealers = dealers.filter((d) => d.status === 'suspended' || d.status === 'blocked').length;

    const totalProducts = products.length;
    const inStock = products.filter((p) => p.stock_status !== 'out_of_stock').length;
    const outOfStock = products.filter((p) => p.stock_status === 'out_of_stock').length;
    const featuredCount = products.filter((p) => p.is_featured).length;

    const totalCategories = categories.length;
    const pendingEnquiries = enquiries.filter((e) => (e as any).status !== 'completed').length;
    const totalReviews = reviews.length;

    return {
      totalDealers,
      approvedDealers,
      pendingDealers,
      suspendedDealers,
      totalProducts,
      inStock,
      outOfStock,
      featuredCount,
      totalCategories,
      pendingEnquiries,
      totalReviews,
    };
  }, [dealers, products, categories, enquiries, reviews]);

  // Real 7-day search activity from search_logs
  const searchActivity = useMemo(() => {
    const days: Record<string, { searches: number; pinCount: Set<string> }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      days[key] = { searches: 0, pinCount: new Set() };
    }
    searchLogs.forEach((l) => {
      if (!l.created_at) return;
      const d = new Date(l.created_at);
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff > 6) return;
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      if (days[key]) {
        days[key].searches++;
        if (l.pin_code) days[key].pinCount.add(l.pin_code);
      }
    });
    return Object.entries(days).map(([day, v]) => ({
      day,
      searches: v.searches,
      locations: v.pinCount.size,
    }));
  }, [searchLogs]);

  // Real category distribution from products
  const categoryDist = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const catName = p.category?.name || 'Uncategorized';
      map[catName] = (map[catName] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [products]);

  // Recent dealers
  const recentDealers = useMemo(() => {
    return [...dealers]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [dealers]);

  // Recent enquiries
  const recentEnquiries = useMemo(() => {
    return [...enquiries]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [enquiries]);

  return (
    <div className="space-y-6">
      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Platform Control Dashboard
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Live database overview, critical approvals & system management actions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenLayoutManager}
            className="h-9 gap-1.5 font-semibold"
          >
            <Sliders className="h-4 w-4" /> Customize Layout
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigateTab('04-products')}
            className="h-9 gap-1.5 font-semibold"
          >
            <Plus className="h-4 w-4" /> Add Master Product
          </Button>
          {stats.pendingDealers > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onNavigateTab('02-dealers')}
              className="h-9 gap-1.5 font-semibold animate-pulse"
            >
              <Clock className="h-4 w-4" /> Review {stats.pendingDealers} Pending
            </Button>
          )}
        </div>
      </div>

      {/* 8 Essential Platform Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-primary/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Customers</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {formatCompact(customerCount)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Registered users</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-emerald-500/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Approved Shops</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.approvedDealers}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Active dealers</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-amber-500/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Pending Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {stats.pendingDealers}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Awaiting approval</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-primary/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Master Catalog</span>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {stats.totalProducts}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Catalog items</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-primary/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Categories</span>
            <FolderTree className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {stats.totalCategories}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Across 8 groups</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-emerald-500/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">In Stock</span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {stats.inStock}
          </div>
          <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">Available live</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-destructive/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Out of Stock</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-destructive">
            {stats.outOfStock}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Needs restock</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-primary/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Enquiries</span>
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {enquiries.length}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{stats.pendingEnquiries} active leads</div>
        </Card>
      </div>

      {/* Quick Action Navigation Buttons */}
      <Card className="p-4 border-border/80 bg-muted/20">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Quick Control Shortcuts
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('02-dealers')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <Store className="h-3.5 w-3.5 text-primary" /> Dealer Approvals
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('04-products')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <Package className="h-3.5 w-3.5 text-primary" /> Master Catalog
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('07-inventory')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Stock Inspector
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('10-homepage')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <PanelsTopLeft className="h-3.5 w-3.5 text-primary" /> Manage Homepage
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('11-notifications')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <Bell className="h-3.5 w-3.5 text-primary" /> Broadcast Notification
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('14-settings')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <Shield className="h-3.5 w-3.5 text-primary" /> Admin Security
          </Button>
        </div>
      </Card>

      {/* Two Live Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 7-Day Search Traffic */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> 7-Day Real Search Volume
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Daily searches recorded from customer applications
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {searchLogs.length} Total Logs
            </Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={searchActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="searches"
                  name="Searches"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="locations"
                  name="Unique PINs"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category Breakdown */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Product Category Distribution
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Breakdown of active listings across main categories
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Top 6 Categories
            </Badge>
          </div>
          <div className="h-60 w-full flex items-center justify-center">
            {categoryDist.length === 0 ? (
              <p className="text-xs text-muted-foreground">No category data recorded yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {categoryDist.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Two Recent Tables: Dealers & Enquiries */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Dealers */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" /> Recent Dealer Registrations
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Latest shop registration submissions
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('02-dealers')}
              className="text-xs font-semibold gap-1"
            >
              View All <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="divide-y divide-border/60">
            {recentDealers.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No dealers registered yet</div>
            ) : (
              recentDealers.map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">{d.shop_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.city}, PIN: {d.pin_code} • {d.owner_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={d.status === 'approved' ? 'default' : d.status === 'pending' ? 'secondary' : 'destructive'}
                      className="text-[10px] capitalize font-medium"
                    >
                      {d.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(d.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Enquiries */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Recent Customer Enquiries
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Customer leads & dealer quotes dispatched
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('08-enquiries')}
              className="text-xs font-semibold gap-1"
            >
              View All <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="divide-y divide-border/60">
            {recentEnquiries.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No enquiries received yet</div>
            ) : (
              recentEnquiries.map((e) => (
                <div key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {e.customer_name || 'Anonymous Customer'}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {e.message || 'Product price & availability inquiry'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {e.channel}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(e.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
