'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Scale, X, Check, MapPin, Star, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/providers';
import { supabase, type Product } from '@/lib/supabase';
import { formatINR, getEffectivePrice, getDiscountPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export function CompareClient() {
  const { compare, toggleCompare, clearCompare, t } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (compare.length === 0) { setProducts([]); setLoading(false); return; }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
          .in('id', compare);
        if (error) throw error;
        setProducts(data ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [compare]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (products.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Scale className="h-8 w-8 text-muted-foreground" /></div>
        <h1 className="text-xl font-bold">No products to compare</h1>
        <p className="text-sm text-muted-foreground">Add products to compare by clicking the Compare button on any product.</p>
        <Button asChild><Link href="/search">Browse products</Link></Button>
      </div>
    );
  }

  const specKeys = Array.from(new Set(products.flatMap((p) => Object.keys(p.specifications))));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold"><Scale className="h-5 w-5 text-primary" /> Compare Products ({products.length})</h1>
        <Button variant="outline" size="sm" onClick={clearCompare}><Trash2 className="mr-1 h-4 w-4" /> Clear all</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {/* Product header row */}
            <tr>
              <td className="sticky left-0 z-10 w-32 bg-background p-3 text-xs font-medium text-muted-foreground">Product</td>
              {products.map((p) => (
                <td key={p.id} className="min-w-[200px] p-3 align-top">
                  <Card className="relative overflow-hidden p-0">
                    <button onClick={() => toggleCompare(p.id)} className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur hover:bg-background"><X className="h-4 w-4" /></button>
                    <Link href={`/product/${p.id}`}>
                      <div className="relative aspect-square bg-muted">
                        <Image src={p.images[0] ?? 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400'} alt={p.name} fill sizes="200px" className="object-cover" />
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{p.brand?.name}</p>
                      </div>
                    </Link>
                  </Card>
                </td>
              ))}
            </tr>
            {/* Price */}
            <CompareRow label="Price" products={products} render={(p) => <span className="font-bold">{formatINR(getEffectivePrice(p.price, p.discount_price))}</span>} highlightBest={(products) => {
              const prices = products.map((p) => getEffectivePrice(p.price, p.discount_price));
              const min = Math.min(...prices);
              return prices.indexOf(min);
            }} />
            <CompareRow label="Discount" products={products} render={(p) => { const d = getDiscountPercent(p.price, p.discount_price); return d > 0 ? <Badge className="bg-destructive/15 text-destructive">{d}%</Badge> : <span className="text-muted-foreground">—</span>; }} />
            <CompareRow label="Stock" products={products} render={(p) => (
              <span className={cn('flex items-center gap-1.5', p.stock_status === 'in_stock' ? 'text-success' : p.stock_status === 'limited' ? 'text-warning' : 'text-destructive')}>
                <span className={cn('h-2 w-2 rounded-full', p.stock_status === 'in_stock' ? 'bg-success' : p.stock_status === 'limited' ? 'bg-warning' : 'bg-destructive')} />
                {p.stock_status === 'in_stock' ? `${p.stock_qty} available` : p.stock_status === 'limited' ? 'Limited' : 'Out of stock'}
              </span>
            )} />
            <CompareRow label="Shop" products={products} render={(p) => p.dealer ? <Link href={`/dealer/${p.dealer.id}`} className="flex items-center gap-1 text-sm hover:text-primary"><Store className="h-3 w-3" /> {p.dealer.shop_name}</Link> : '—'} />
            <CompareRow label="Rating" products={products} render={(p) => p.dealer ? <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-warning text-warning" /> {p.dealer.rating.toFixed(1)}</span> : '—'} highlightBest={(products) => {
              const ratings = products.map((p) => p.dealer?.rating ?? 0);
              const max = Math.max(...ratings);
              return ratings.indexOf(max);
            }} />
            <CompareRow label="Location" products={products} render={(p) => p.dealer ? <span className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3" /> {p.dealer.city}</span> : '—'} />
            <CompareRow label="Delivery" products={products} render={(p) => p.delivery_available ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground" />} />
            <CompareRow label="Pickup" products={products} render={(p) => p.pickup_available ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-muted-foreground" />} />
            <CompareRow label="Warranty" products={products} render={(p) => <span className="text-sm">{p.warranty ?? '—'}</span>} />
            {/* Specs */}
            {specKeys.map((key) => (
              <CompareRow key={key} label={key.replace(/_/g, ' ')} products={products} render={(p) => <span className="text-sm">{p.specifications[key] ?? '—'}</span>} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareRow({ label, products, render, highlightBest }: {
  label: string;
  products: Product[];
  render: (p: Product) => React.ReactNode;
  highlightBest?: (products: Product[]) => number;
}) {
  const bestIdx = highlightBest ? highlightBest(products) : -1;
  return (
    <tr className="border-t border-border/50">
      <td className="sticky left-0 z-10 bg-background p-3 text-xs font-medium capitalize text-muted-foreground">{label}</td>
      {products.map((p, i) => (
        <td key={p.id} className={cn('min-w-[200px] p-3', bestIdx === i && 'bg-success/5')}>
          {render(p)}
          {bestIdx === i && <Badge className="ml-2 bg-success/15 text-success text-[10px]">Best</Badge>}
        </td>
      ))}
    </tr>
  );
}
