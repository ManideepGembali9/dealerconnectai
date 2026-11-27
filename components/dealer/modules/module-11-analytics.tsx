'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatCompact,formatINR,getEffectivePrice } from '@/lib/format';
import type { Dealer,Enquiry,Product } from '@/lib/types';
import {
  BarChart3,
  DollarSign,
  Eye,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,YAxis
} from 'recharts';

type Module11Props = {
  dealer: Dealer;
  products: Product[];
  enquiries: Enquiry[];
};

export function Module11DealerAnalytics({ dealer, products, enquiries }: Module11Props) {
  const analyticsData = useMemo(() => {
    const totalViews = products.reduce((acc, p) => acc + (p.view_count || 0), 0);
    const totalSearches = products.reduce((acc, p) => acc + (p.search_count || 0), 0);
    const totalStockUnits = products.reduce((acc, p) => acc + (p.stock_qty || 0), 0);
    const totalValue = products.reduce(
      (acc, p) => acc + getEffectivePrice(p.price, p.discount_price) * (p.stock_qty || 1),
      0
    );

    const chartData = products.slice(0, 6).map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + '...' : p.name,
      views: p.view_count || 0,
      searches: p.search_count || 0,
    }));

    const topItems = [...products]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 5);

    return { totalViews, totalSearches, totalStockUnits, totalValue, chartData, topItems };
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-emerald-600" /> Shop Analytics & Performance
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Actual showroom performance derived from live customer searches, buyer views & incoming leads
        </p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Buyer Views <Eye className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-2xl font-bold text-foreground mt-2">
            {formatCompact(analyticsData.totalViews)}
          </div>
          <span className="text-[10px] text-muted-foreground">Times your items appeared</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Search Matches <TrendingUp className="h-4 w-4 text-primary" />
          </span>
          <div className="text-2xl font-bold text-foreground mt-2">
            {formatCompact(analyticsData.totalSearches)}
          </div>
          <span className="text-[10px] text-muted-foreground">Local search impressions</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Customer Inquiries <MessageSquare className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {enquiries.length}
          </div>
          <span className="text-[10px] text-muted-foreground">Direct customer leads</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Inventory Valuation <DollarSign className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-xl font-bold text-foreground mt-2 truncate">
            {formatINR(analyticsData.totalValue)}
          </div>
          <span className="text-[10px] text-muted-foreground">In active stock</span>
        </Card>
      </div>

      {/* Chart: Product Views Breakdown */}
      <Card className="p-5 border-border/80">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Buyer Interest by Listed Product
            </h3>
            <p className="text-[11px] text-muted-foreground">Direct view counters from buyer devices</p>
          </div>
          <Badge variant="outline" className="text-[10px]">Real Store Data</Badge>
        </div>

        <div className="h-60 w-full">
          {analyticsData.chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No products listed yet to generate analytics.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="views" name="Product Views" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
