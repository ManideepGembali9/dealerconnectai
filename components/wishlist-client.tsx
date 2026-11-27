'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProductCard } from '@/components/product-card';
import { useApp } from '@/lib/providers';
import { fetchProducts } from '@/lib/data';
import type { Product } from '@/lib/types';

export function WishlistClient() {
  const { wishlist, t } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (wishlist.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const all = await fetchProducts({ limit: 100 });
        const matched = all.filter((p) => wishlist.includes(p.id));
        setProducts(matched);
      } catch (e) {
        console.error('Wishlist error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [wishlist]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-4 py-24 text-center text-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted border border-border">
          <Heart className="h-8 w-8 text-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Your wishlist is empty</h1>
        <p className="text-sm text-muted-foreground">
          Save products you&apos;re interested in by tapping the heart icon.
        </p>
        <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl">
          <Link href="/search">Browse products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 text-foreground">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-black text-foreground">
        <Heart className="h-6 w-6 fill-current text-foreground" /> {t('myWishlist')} ({products.length})
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
