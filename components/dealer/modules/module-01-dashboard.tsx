'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCompact,formatINR,getEffectivePrice,timeAgo } from '@/lib/format';
import type { Dealer,Enquiry,Product,Review } from '@/lib/types';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  MessageSquare,
  Package,
  Plus,ShieldCheck,
  Store,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { useMemo } from 'react';

type Module01Props = {
  dealer: Dealer;
  products: Product[];
  enquiries: Enquiry[];
  reviews: Review[];
  onNavigateTab: (tabId: string) => void;
};

export function Module01DealerDashboard({
  dealer,
  products,
  enquiries,
  reviews,
  onNavigateTab,
}: Module01Props) {
  const stats = useMemo(() => {
    const totalListed = products.length;
    const available = products.filter(
      (p) => p.stock_status === 'in_stock' || p.stock_status === 'limited'
    ).length;
    const outOfStock = products.filter((p) => p.stock_status === 'out_of_stock').length;
    const pendingEnquiries = enquiries.filter(
      (e) => (e as any).status === 'pending' || (e as any).status === 'new'
    ).length;
    const totalViews = products.reduce((sum, p) => sum + (p.view_count || 0), 0);
    const totalInventoryValue = products.reduce(
      (sum, p) => sum + getEffectivePrice(p.price, p.discount_price) * (p.stock_qty || 1),
      0
    );

    // Profile completion calculation
    let completedFields = 0;
    const totalFields = 8;
    if (dealer.shop_name) completedFields++;
    if (dealer.owner_name) completedFields++;
    if (dealer.phone) completedFields++;
    if (dealer.address) completedFields++;
    if (dealer.pin_code) completedFields++;
    if (dealer.working_hours && Object.keys(dealer.working_hours).length > 0) completedFields++;
    if (dealer.description) completedFields++;
    if (dealer.gst_number || dealer.whatsapp) completedFields++;
    const profilePercent = Math.round((completedFields / totalFields) * 100);

    return {
      totalListed,
      available,
      outOfStock,
      pendingEnquiries,
      totalViews,
      totalInventoryValue,
      profilePercent,
    };
  }, [products, enquiries, dealer]);

  const recentEnquiries = useMemo(() => {
    return [...enquiries]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  }, [enquiries]);

  const topProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 4);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Welcome & Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {dealer.shop_name}
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Merchant Console • {dealer.city}, PIN: {dealer.pin_code} • Rating: {dealer.rating.toFixed(1)} ★
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => onNavigateTab('04-add-products')}
            className="h-9 gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Master Product
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateTab('02-profile')}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            Edit Shop Profile
          </Button>
        </div>
      </div>

      {/* Shop Profile Completion Card */}
      {stats.profilePercent < 100 && (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-xs sm:text-sm text-foreground">
                Shop Profile Completion: {stats.profilePercent}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Complete your store working hours, WhatsApp contact, and description to maximize local buyer inquiries.
            </p>
            <Progress value={stats.profilePercent} className="h-1.5 w-full max-w-md mt-1.5" />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateTab('02-profile')}
            className="h-8 text-xs font-semibold shrink-0"
          >
            Complete Profile →
          </Button>
        </Card>
      )}

      {/* 6 Essential Performance Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-emerald-500/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Total Listed</span>
            <Package className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {stats.totalListed}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Shop catalog</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-emerald-500/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Available</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.available}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">In stock for buyers</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-destructive/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Out of Stock</span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-destructive">
            {stats.outOfStock}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Needs replenishment</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-amber-500/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Pending Leads</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {stats.pendingEnquiries}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Open buyer queries</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-primary/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Total Views</span>
            <Eye className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {formatCompact(stats.totalViews)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Buyer catalog visits</div>
        </Card>

        <Card className="p-3.5 border-border/80 shadow-sm transition-all hover:border-primary/50">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold">Inventory Value</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-foreground truncate">
            {formatINR(stats.totalInventoryValue)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">Estimated retail value</div>
        </Card>
      </div>

      {/* Quick Action Navigation Grid */}
      <Card className="p-4 border-border/80 bg-muted/20">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Quick Management Shortcuts
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('03-products')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <Package className="h-3.5 w-3.5 text-emerald-600" /> My Products
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('04-add-products')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-600" /> Add Master Item
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('05-inventory')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Stock Count
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('08-enquiries')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> Customer Leads
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('12-delivery')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Delivery Radius
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('02-profile')}
            className="justify-start gap-2 h-9 text-xs font-semibold bg-card"
          >
            <Store className="h-3.5 w-3.5 text-emerald-600" /> Shop Profile
          </Button>
        </div>
      </Card>

      {/* Two Recent Tables: Leads & Popular Products */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Customer Inquiries */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" /> Recent Customer Leads
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Local buyers asking for live price & availability
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('08-enquiries')}
              className="text-xs font-semibold gap-1 text-emerald-600 hover:text-emerald-700"
            >
              View All ({enquiries.length}) <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="divide-y divide-border/60">
            {recentEnquiries.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No customer enquiries received yet.
              </div>
            ) : (
              recentEnquiries.map((e) => (
                <div key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {e.customer_name || 'Interested Buyer'}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {e.message || 'Product stock & pickup inquiry'}
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

        {/* Most Viewed Products in this Shop */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Most Popular Products
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Products attracting the highest buyer views
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateTab('03-products')}
              className="text-xs font-semibold gap-1 text-primary hover:underline"
            >
              Catalog <ArrowUpRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="divide-y divide-border/60">
            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No products added yet. Use &quot;Add Products&quot; to pick from the master catalog.
              </div>
            ) : (
              topProducts.map((p, idx) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-muted-foreground font-bold w-4">#{idx + 1}</span>
                    <div>
                      <p className="font-bold text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.category?.name || 'General'} • {formatINR(getEffectivePrice(p.price, p.discount_price))}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {p.view_count || 0} views
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
