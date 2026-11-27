'use client';

import { useState, useMemo } from 'react';
import {
  Boxes, Search, CheckCircle2, AlertTriangle, ArrowUpDown,
  DollarSign, Package, Save, Check
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Product, Dealer } from '@/lib/types';
import { formatINR, getEffectivePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Module05Props = {
  dealer: Dealer;
  products: Product[];
  onRefreshProducts: () => Promise<void>;
};

export function Module05DealerInventory({ dealer, products, onRefreshProducts }: Module05Props) {
  const [search, setSearch] = useState('');
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const inventorySummary = useMemo(() => {
    const totalUnits = products.reduce((acc, p) => acc + (p.stock_qty || 0), 0);
    const inStock = products.filter((p) => p.stock_status === 'in_stock').length;
    const lowStock = products.filter(
      (p) => p.stock_status === 'limited' || (p.stock_qty > 0 && p.stock_qty <= 5)
    ).length;
    const outOfStock = products.filter((p) => p.stock_status === 'out_of_stock').length;
    const totalRetailValue = products.reduce(
      (acc, p) => acc + getEffectivePrice(p.price, p.discount_price) * (p.stock_qty || 0),
      0
    );

    return { totalUnits, inStock, lowStock, outOfStock, totalRetailValue };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand?.name?.toLowerCase().includes(q) ||
          p.category?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, search]);

  const handleInlineStockSave = async (p: Product) => {
    const newQty = stockEdits[p.id] !== undefined ? stockEdits[p.id] : p.stock_qty;
    const newStatus =
      newQty <= 0 ? 'out_of_stock' : newQty <= 5 ? 'limited' : 'in_stock';

    setSavingId(p.id);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          stock_qty: newQty,
          stock_status: newStatus,
        })
        .eq('id', p.id);

      if (error) throw error;
      toast.success(`Updated stock for ${p.name}`);
      await onRefreshProducts();
    } catch {
      toast.error('Failed to update stock');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Boxes className="h-7 w-7 text-emerald-600" /> Inventory Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Fast stock replenishment, warehouse count auditing & total retail inventory evaluation
          </p>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Total Units <Package className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-2xl font-bold text-foreground mt-2">
            {inventorySummary.totalUnits}
          </div>
          <span className="text-[10px] text-muted-foreground">In showroom warehouse</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            In Stock Items <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {inventorySummary.inStock}
          </div>
          <span className="text-[10px] text-muted-foreground">Ready for customer collection</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Low Stock Alerts <AlertTriangle className="h-4 w-4 text-amber-500" />
          </span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {inventorySummary.lowStock}
          </div>
          <span className="text-[10px] text-muted-foreground">5 or fewer remaining</span>
        </Card>

        <Card className="p-4 border-border/80">
          <span className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            Inventory Valuation <DollarSign className="h-4 w-4 text-emerald-600" />
          </span>
          <div className="text-2xl font-bold text-foreground mt-2 truncate">
            {formatINR(inventorySummary.totalRetailValue)}
          </div>
          <span className="text-[10px] text-muted-foreground">Total stock worth</span>
        </Card>
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search inventory items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Inventory Table */}
      <Card className="border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit Price</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Stock Status</th>
                <th className="px-4 py-3 text-right">Instant Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProducts.map((p) => {
                const currentQty =
                  stockEdits[p.id] !== undefined ? stockEdits[p.id] : p.stock_qty || 0;
                const hasChanged = stockEdits[p.id] !== undefined && stockEdits[p.id] !== p.stock_qty;

                return (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-foreground text-xs sm:text-sm block">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        SKU: {p.sku || p.id.slice(0, 8)}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold text-foreground">
                        {p.category?.name || 'General'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-bold text-foreground">
                      {formatINR(getEffectivePrice(p.price, p.discount_price))}
                    </td>

                    <td className="px-4 py-3.5">
                      <Input
                        type="number"
                        value={currentQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setStockEdits((prev) => ({ ...prev, [p.id]: val }));
                        }}
                        className="h-8 w-24 text-xs font-bold"
                        min={0}
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      <Badge
                        variant={
                          currentQty > 5
                            ? 'default'
                            : currentQty > 0
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-[10px] capitalize font-semibold"
                      >
                        {currentQty > 5 ? 'In Stock' : currentQty > 0 ? 'Limited' : 'Out of Stock'}
                      </Badge>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        disabled={!hasChanged || savingId === p.id}
                        onClick={() => handleInlineStockSave(p)}
                        className="h-8 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
                      >
                        {savingId === p.id ? 'Saving...' : 'Save Stock'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
