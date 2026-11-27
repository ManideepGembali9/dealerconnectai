'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,SelectContent,SelectItem,SelectTrigger,SelectValue,
} from '@/components/ui/select';
import { formatINR,getEffectivePrice } from '@/lib/format';
import type { Dealer,Product } from '@/lib/types';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Search,
  ShieldAlert,
  Store
} from 'lucide-react';
import { useMemo,useState } from 'react';

type Module07Props = {
  products: Product[];
  dealers: Dealer[];
  onNavigateTab: (tabId: string) => void;
};

export function Module07Inventory({ products, dealers, onNavigateTab }: Module07Props) {
  const [search, setSearch] = useState('');
  const [selectedDealerId, setSelectedDealerId] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  const filteredItems = useMemo(() => {
    return products.filter((p) => {
      if (selectedDealerId !== 'all' && p.dealer_id !== selectedDealerId) return false;
      if (stockFilter !== 'all' && p.stock_status !== stockFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDealer = p.dealer?.shop_name.toLowerCase().includes(q);
        const matchCity = p.dealer?.city.toLowerCase().includes(q);
        if (!matchName && !matchDealer && !matchCity) return false;
      }
      return true;
    });
  }, [products, selectedDealerId, stockFilter, search]);

  const stockSummary = useMemo(() => {
    const inStock = products.filter((p) => p.stock_status === 'in_stock').length;
    const limited = products.filter((p) => p.stock_status === 'limited').length;
    const outOfStock = products.filter((p) => p.stock_status === 'out_of_stock').length;
    return { inStock, limited, outOfStock };
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Boxes className="h-7 w-7 text-primary" /> Inventory & Stock Inspector
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Monitor real-time merchant stock availability, dealer pricing tiers & identify out-of-stock items
          </p>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Merchant Price & Stock Safety Isolation:</span>
          Admins have read-only visibility into dealer-specific inventories here. Editing the master catalog will never overwrite an individual dealer&apos;s custom store price or live stock count.
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 border-border/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">In Stock</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {stockSummary.inStock}
            </div>
            <span className="text-[10px] text-muted-foreground">Ready for immediate fulfillment</span>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
        </Card>

        <Card className="p-4 border-border/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">Limited Stock</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {stockSummary.limited}
            </div>
            <span className="text-[10px] text-muted-foreground">Under 5 units remaining</span>
          </div>
          <AlertTriangle className="h-8 w-8 text-amber-500/30" />
        </Card>

        <Card className="p-4 border-border/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">Out of Stock</span>
            <div className="text-2xl font-bold text-destructive mt-1">
              {stockSummary.outOfStock}
            </div>
            <span className="text-[10px] text-muted-foreground">Unavailable across showrooms</span>
          </div>
          <AlertTriangle className="h-8 w-8 text-destructive/30" />
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
            <SelectTrigger className="w-52 h-9 text-xs">
              <SelectValue placeholder="All Dealerships" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Dealerships ({dealers.length})
              </SelectItem>
              {dealers.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.shop_name} ({d.city})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Stock Levels
              </SelectItem>
              <SelectItem value="in_stock" className="text-xs">
                In Stock Only
              </SelectItem>
              <SelectItem value="limited" className="text-xs">
                Limited Stock
              </SelectItem>
              <SelectItem value="out_of_stock" className="text-xs">
                Out of Stock
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search product or shop..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Mobile Inventory Cards (< 768px) */}
      <div className="md:hidden space-y-2.5">
        {filteredItems.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
            <Boxes className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
            No products matching your inventory criteria.
          </Card>
        ) : (
          filteredItems.map((p) => {
            const effective = getEffectivePrice(p.price, p.discount_price);
            return (
              <Card key={p.id} className="p-4 border-border/80 rounded-2xl space-y-2 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.dealer?.shop_name || 'Central Master'} • {p.category?.name || 'General'}</p>
                  </div>
                  <Badge variant={p.stock_status === 'in_stock' ? 'default' : p.stock_status === 'limited' ? 'secondary' : 'destructive'} className="text-[10px] capitalize shrink-0">
                    {p.stock_status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <div>
                    <span className="font-bold">{formatINR(effective)}</span>
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">{p.stock_qty ?? 0} units</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onNavigateTab('04-products')} className="h-8 text-[11px] font-semibold text-primary">
                    View <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Cross-Dealer Inventory Table (>= 768px) */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Product Name & Category</th>
                <th className="px-4 py-3">Dealer / Showroom</th>
                <th className="px-4 py-3">Pricing Tier</th>
                <th className="px-4 py-3">Stock Units</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3 text-right">Master Catalog</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Boxes className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    No products matching your inventory criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((p) => {
                  const effective = getEffectivePrice(p.price, p.discount_price);
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground text-xs sm:text-sm">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.category?.name || 'General'} • {p.brand?.name || 'Brand'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <Store className="h-3 w-3 text-primary shrink-0" />
                          {p.dealer?.shop_name || 'Central Master'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.dealer?.city || 'Local'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground">{formatINR(effective)}</div>
                        {p.discount_price && (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {formatINR(p.price)}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-xs">{p.stock_qty ?? 0}</span>{' '}
                        <span className="text-[10px] text-muted-foreground">units</span>
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge
                          variant={
                            p.stock_status === 'in_stock'
                              ? 'default'
                              : p.stock_status === 'limited'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="text-[10px] capitalize font-semibold"
                        >
                          {p.stock_status.replace(/_/g, ' ')}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onNavigateTab('04-products')}
                          className="h-8 text-xs font-semibold text-primary hover:underline gap-1"
                        >
                          View Master <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
