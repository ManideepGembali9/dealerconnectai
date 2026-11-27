'use client';

import { useState, useMemo } from 'react';
import {
  DollarSign, Search, Tag, Percent, TrendingDown, Save, ArrowUpDown
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Product, Dealer } from '@/lib/types';
import { formatINR, getEffectivePrice, getDiscountPercent } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Module06Props = {
  dealer: Dealer;
  products: Product[];
  onRefreshProducts: () => Promise<void>;
};

export function Module06DealerPricing({ dealer, products, onRefreshProducts }: Module06Props) {
  const [search, setSearch] = useState('');
  const [priceEdits, setPriceEdits] = useState<Record<string, { price: number; discount: number | null }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const handlePriceUpdate = async (p: Product) => {
    const edit = priceEdits[p.id];
    if (!edit) return;

    setSavingId(p.id);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          price: edit.price,
          discount_price: edit.discount,
        })
        .eq('id', p.id);

      if (error) throw error;
      toast.success(`Pricing updated for ${p.name}`);
      await onRefreshProducts();
    } catch {
      toast.error('Failed to update price');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <DollarSign className="h-7 w-7 text-emerald-600" /> Price Management
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Set shop showroom retail prices, promotional discount offers & calculate buyer savings
        </p>
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search items for price adjustment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Pricing Table Card */}
      <Card className="border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Store Price (MRP ₹)</th>
                <th className="px-4 py-3">Offer Price (₹)</th>
                <th className="px-4 py-3">Calculated Discount</th>
                <th className="px-4 py-3">Buyer Effective Price</th>
                <th className="px-4 py-3 text-right">Save Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredProducts.map((p) => {
                const currentPrice = priceEdits[p.id]?.price !== undefined ? priceEdits[p.id].price : p.price;
                const currentDiscount =
                  priceEdits[p.id] !== undefined ? priceEdits[p.id].discount : p.discount_price;
                const effective = getEffectivePrice(currentPrice, currentDiscount);
                const discountPct = getDiscountPercent(currentPrice, currentDiscount);
                const hasChanged = priceEdits[p.id] !== undefined;

                return (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-foreground text-xs sm:text-sm block">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {p.brand?.name || 'General'} • {p.category?.name || 'General'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-semibold">₹</span>
                        <Input
                          type="number"
                          value={currentPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPriceEdits((prev) => ({
                              ...prev,
                              [p.id]: { price: val, discount: currentDiscount },
                            }));
                          }}
                          className="h-8 w-28 text-xs font-bold"
                          min={0}
                        />
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-semibold">₹</span>
                        <Input
                          type="number"
                          value={currentDiscount || ''}
                          placeholder="No discount"
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            setPriceEdits((prev) => ({
                              ...prev,
                              [p.id]: { price: currentPrice, discount: val },
                            }));
                          }}
                          className="h-8 w-28 text-xs font-bold"
                          min={0}
                        />
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {discountPct > 0 ? (
                        <Badge className="bg-emerald-600 font-bold text-[10px]">
                          {discountPct}% OFF
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Regular MRP</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-bold text-foreground text-xs sm:text-sm">
                      {formatINR(effective)}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        disabled={!hasChanged || savingId === p.id}
                        onClick={() => handlePriceUpdate(p)}
                        className="h-8 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
                      >
                        {savingId === p.id ? 'Saving...' : 'Update Price'}
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
