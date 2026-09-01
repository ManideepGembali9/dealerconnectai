'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProductCard } from '@/components/product-card';
import { useApp } from '@/lib/providers';
import { supabase, type Product } from '@/lib/supabase';

export function WishlistClient() {
  const { wishlist } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (wishlist.length === 0) { setProducts([]); setLoading(false); return; }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
          .in('id', wishlist);
        if (error) throw error;
        setProducts(data ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [wishlist]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (products.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Heart className="h-8 w-8 text-muted-foreground" /></div>
        <h1 className="text-xl font-bold">Your wishlist is empty</h1>
        <p className="text-sm text-muted-foreground">Save products you're interested in by tapping the heart icon.</p>
        <Button asChild><Link href="/search">Browse products</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold"><Heart className="h-5 w-5 text-destructive" /> My Wishlist ({products.length})</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
