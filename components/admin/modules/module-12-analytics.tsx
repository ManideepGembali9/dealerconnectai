'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCompact } from '@/lib/format';
import type { Category,Dealer,Enquiry,Product } from '@/lib/types';
import {
  BarChart3,
  Download,
  Eye,
  MessageSquare,
  Search,
  Store,
  TrendingUp,Users
} from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,YAxis
} from 'recharts';
import { toast } from 'sonner';

type Module12Props = {
  dealers: Dealer[];
  products: Product[];
  categories: Category[];
  customerCount: number;
  searchLogs: any[];
  enquiries: Enquiry[];
};

export function Module12Analytics({
  dealers,
  products,
  categories,
  customerCount,
  searchLogs,
  enquiries,
}: Module12Props) {
  // Top viewed products from actual products data
  const topViewed = useMemo(() => {
    return [...products]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 7);
  }, [products]);

  // Search queries frequency from search_logs
  const topQueries = useMemo(() => {
    const map: Record<string, number> = {};
    searchLogs.forEach((l) => {
      const q = l.query?.trim();
      if (q) map[q] = (map[q] || 0) + 1;
    });
    return Object.entries(map)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [searchLogs]);

  // Dealer activity breakdown
  const dealerActivity = useMemo(() => {
    return [...dealers]
      .sort((a, b) => (b.product_count || 0) - (a.product_count || 0))
      .slice(0, 6)
      .map((d) => ({
        name: d.shop_name.length > 15 ? d.shop_name.slice(0, 15) + '...' : d.shop_name,
        products: d.product_count || 0,
        rating: d.rating || 0,
      }));
  }, [dealers]);

  // 7-day search volume
  const searchTimeline = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      days[key] = 0;
    }
    searchLogs.forEach((l) => {
      if (!l.created_at) return;
      const d = new Date(l.created_at);
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diff > 6) return;
      const key = d.toLocaleDateString('en', { weekday: 'short' });
      if (days[key] !== undefined) days[key]++;
    });
    return Object.entries(days).map(([day, volume]) => ({ day, volume }));
  }, [searchLogs]);

  const handleExportCSV = () => {
    const reportData = [
      ['Metric', 'Value'],
      ['Total Registered Customers', customerCount],
      ['Total Dealerships', dealers.length],
      ['Approved Dealerships', dealers.filter((d) => d.status === 'approved').length],
      ['Pending Dealerships', dealers.filter((d) => d.status === 'pending').length],
      ['Total Master Products', products.length],
      ['Total In-Stock Products', products.filter((p) => p.stock_status !== 'out_of_stock').length],
      ['Total Customer Enquiries', enquiries.length],
      ['Total Search Logs Recorded', searchLogs.length],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + reportData.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dealerconnect_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Analytics CSV export downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Analytics & Reports
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Live database intelligence: customer adoption, dealership growth, popular queries & demand metrics
          </p>
        </div>

        <Button onClick={handleExportCSV} variant="outline" className="font-semibold gap-1.5 self-start sm:self-auto">
          <Download className="h-4 w-4" /> Export Report (CSV)
        </Button>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Customer Accounts <Users className="h-4 w-4 text-primary" />
          </span>
          <div className="text-2xl font-bold text-foreground mt-2">{formatCompact(customerCount)}</div>
          <span className="text-[10px] text-muted-foreground">Active platform users</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Approved Dealers <Store className="h-4 w-4 text-emerald-500" />
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {dealers.filter((d) => d.status === 'approved').length}
          </div>
          <span className="text-[10px] text-muted-foreground">Verified merchant partners</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Recorded Searches <Search className="h-4 w-4 text-primary" />
          </span>
          <div className="text-2xl font-bold text-foreground mt-2">{searchLogs.length}</div>
          <span className="text-[10px] text-muted-foreground">Logged customer queries</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Customer Inquiries <MessageSquare className="h-4 w-4 text-primary" />
          </span>
          <div className="text-2xl font-bold text-foreground mt-2">{enquiries.length}</div>
          <span className="text-[10px] text-muted-foreground">Leads routed to dealers</span>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Search Activity Chart */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> 7-Day Customer Search Volume
              </h3>
              <p className="text-[11px] text-muted-foreground">Search volume from live user traffic</p>
            </div>
            <Badge variant="outline" className="text-[10px]">Actual Logs</Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={searchTimeline}>
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
                  dataKey="volume"
                  name="Searches"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Dealer Inventory Capacity */}
        <Card className="p-5 border-border/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" /> Top Dealerships by Product Listings
              </h3>
              <p className="text-[11px] text-muted-foreground">Active inventory volume per dealer</p>
            </div>
            <Badge variant="outline" className="text-[10px]">Showrooms</Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dealerActivity}>
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
                <Bar dataKey="products" name="Products" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tables: Most Viewed Products and Top Search Queries */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Most Viewed Products */}
        <Card className="p-5 border-border/80">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Most Viewed Master Products
          </h3>
          <div className="divide-y divide-border/60">
            {topViewed.map((p, idx) => (
              <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground w-4">#{idx + 1}</span>
                  <div>
                    <span className="font-bold text-foreground">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground block">
                      {p.category?.name || 'General'}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {p.view_count || 0} views
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Search Queries */}
        <Card className="p-5 border-border/80">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Most Frequent Search Queries
          </h3>
          <div className="divide-y divide-border/60">
            {topQueries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No search query records yet</p>
            ) : (
              topQueries.map((q, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground w-4">#{idx + 1}</span>
                    <span className="font-semibold text-foreground">&quot;{q.query}&quot;</span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {q.count} queries
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
