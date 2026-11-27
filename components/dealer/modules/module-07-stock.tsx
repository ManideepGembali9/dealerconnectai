'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,SelectContent,SelectItem,SelectTrigger,SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import type { Dealer,Product } from '@/lib/types';
import {
  CheckCircle2,Search
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { toast } from 'sonner';

type Module07Props = {
  dealer: Dealer;
  products: Product[];
  onRefreshProducts: () => Promise<void>;
};

export function Module07DealerStock({ dealer, products, onRefreshProducts }: Module07Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filter !== 'all' && p.stock_status !== filter) return false;
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
  }, [products, filter, search]);

  const handleStatusChange = async (p: Product, newStatus: Product['stock_status']) => {
    setUpdatingId(p.id);
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_status: newStatus })
        .eq('id', p.id);

      if (error) throw error;
      toast.success(`Availability changed to "${newStatus.replace('_', ' ')}" for ${p.name}`);
      await onRefreshProducts();
    } catch {
      toast.error('Failed to change stock status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" /> Stock & Availability Control
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Quickly switch product availability between In Stock, Limited, Out of Stock, or Temporarily Unavailable
        </p>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Products ({products.length})
              </SelectItem>
              <SelectItem value="in_stock" className="text-xs">
                Available (In Stock)
              </SelectItem>
              <SelectItem value="limited" className="text-xs">
                Limited Stock
              </SelectItem>
              <SelectItem value="out_of_stock" className="text-xs">
                Out of Stock
              </SelectItem>
              <SelectItem value="restocking" className="text-xs">
                Temporarily Unavailable
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Mobile Stock Switcher Cards (< 768px) */}
      <div className="md:hidden space-y-2.5">
        {filtered.map((p) => (
          <Card key={p.id} className="p-3.5 border-border/80 rounded-2xl space-y-2.5 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground truncate">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{p.category?.name || 'General'}</p>
              </div>
              <Badge variant={p.stock_status === 'in_stock' ? 'default' : p.stock_status === 'limited' ? 'secondary' : 'destructive'} className="text-[10px] capitalize shrink-0">
                {p.stock_status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant={p.stock_status === 'in_stock' ? 'default' : 'outline'} disabled={updatingId === p.id} onClick={() => handleStatusChange(p, 'in_stock')} className="h-8 text-[11px] font-semibold">
                In Stock
              </Button>
              <Button size="sm" variant={p.stock_status === 'limited' ? 'default' : 'outline'} disabled={updatingId === p.id} onClick={() => handleStatusChange(p, 'limited')} className="h-8 text-[11px] font-semibold">
                Limited
              </Button>
              <Button size="sm" variant={p.stock_status === 'out_of_stock' ? 'destructive' : 'outline'} disabled={updatingId === p.id} onClick={() => handleStatusChange(p, 'out_of_stock')} className="h-8 text-[11px] font-semibold">
                Out of Stock
              </Button>
              <Button size="sm" variant={p.stock_status === 'restocking' ? 'secondary' : 'outline'} disabled={updatingId === p.id} onClick={() => handleStatusChange(p, 'restocking')} className="h-8 text-[11px] font-semibold">
                Unavailable
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Stock Table Card (>= 768px) */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Status</th>
                <th className="px-4 py-3">Availability Status Switcher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-bold text-foreground text-xs sm:text-sm block">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {p.brand?.name || 'General Brand'}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="text-xs font-semibold text-foreground">
                      {p.category?.name || 'General'}
                    </span>
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

                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={p.stock_status === 'in_stock' ? 'default' : 'outline'}
                        disabled={updatingId === p.id}
                        onClick={() => handleStatusChange(p, 'in_stock')}
                        className={`h-7 px-2.5 text-[10px] font-semibold ${
                          p.stock_status === 'in_stock'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : ''
                        }`}
                      >
                        ✓ In Stock
                      </Button>
                      <Button
                        size="sm"
                        variant={p.stock_status === 'limited' ? 'default' : 'outline'}
                        disabled={updatingId === p.id}
                        onClick={() => handleStatusChange(p, 'limited')}
                        className="h-7 px-2.5 text-[10px] font-semibold text-amber-600"
                      >
                        ⚠ Limited Stock
                      </Button>
                      <Button
                        size="sm"
                        variant={p.stock_status === 'out_of_stock' ? 'destructive' : 'outline'}
                        disabled={updatingId === p.id}
                        onClick={() => handleStatusChange(p, 'out_of_stock')}
                        className="h-7 px-2.5 text-[10px] font-semibold"
                      >
                        ✕ Out of Stock
                      </Button>
                      <Button
                        size="sm"
                        variant={p.stock_status === 'restocking' ? 'secondary' : 'outline'}
                        disabled={updatingId === p.id}
                        onClick={() => handleStatusChange(p, 'restocking')}
                        className="h-7 px-2.5 text-[10px] font-semibold text-muted-foreground"
                      >
                        ⏱ Unavailable
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
