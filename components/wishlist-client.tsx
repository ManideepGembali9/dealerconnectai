'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { fetchProducts } from '@/lib/data';
import { formatINR, getDiscountPercent, getEffectivePrice } from '@/lib/format';
import { useApp } from '@/lib/providers';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Product } from '@/lib/types';
import { ArrowLeft, Check, Heart, ShoppingCart, Store, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export function WishlistClient() {
  const router = useRouter();
  const { customerAuthenticated } = useAuth();
  const { wishlist, toggleWishlist, addToCart, cart, t } = useApp();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWishlistProducts = useCallback(async () => {
    if (wishlist.length === 0) {
      setAllProducts([]);
      setLoading(false);
      return;
    }
    try {
      const all = await fetchProducts({ limit: 500 });
      setAllProducts(all || []);
    } catch (e) {
      console.error('Wishlist error:', e);
    } finally {
      setLoading(false);
    }
  }, [wishlist.length]);

  useRealtimeSync(['products', 'dealers'], loadWishlistProducts, {
    enabled: wishlist.length > 0,
    onReconnect: loadWishlistProducts,
  });

  useEffect(() => {
    loadWishlistProducts();
  }, [loadWishlistProducts]);

  const products = useMemo(() => {
    const wishSet = new Set(wishlist);
    return allProducts.filter((p) => wishSet.has(p.id));
  }, [allProducts, wishlist]);

  const handleMoveToCart = (product: Product) => {
    if (
      product.stock_status === 'out_of_stock' ||
      (typeof product.stock_qty === 'number' && product.stock_qty <= 0)
    ) {
      toast.error('This product is currently out of stock');
      return;
    }
    if (!customerAuthenticated) {
      toast.error('Please login to add items to your cart');
      router.push(`/customer/login?redirect=/wishlist`);
      return;
    }
    const ok = addToCart(product, 1);
    if (ok) {
      toast.success(`${product.name.slice(0, 28)} added to Cart`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
      {/* Minimal Page Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              {t('myWishlist') || 'My Wishlist'}
            </h1>
            {products.length > 0 && (
              <Badge variant="secondary" className="text-xs font-bold">
                {products.length}
              </Badge>
            )}
          </div>
          <Link
            href="/"
            className="hidden md:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Home
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        /* Empty Wishlist State */
        <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center px-6 py-12 text-center animate-in fade-in">
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7E5F]/15 to-[#FF3F6C]/15 border border-[#FF3F6C]/20 shadow-sm">
            <Heart className="h-14 w-14 text-[#FF3F6C]" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Empty Wishlist
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            There is no item in wishlist
          </p>
          <div className="mt-7 w-full max-w-xs">
            <Link
              href="/search"
              className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF3F6C] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/20 hover:opacity-95 transition-all active:scale-[0.98]"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      ) : (
        /* Populated Wishlist Grid */
        <div className="mx-auto max-w-7xl px-3.5 py-5 sm:px-6 sm:py-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((p) => {
              const price = getEffectivePrice(p.price, p.discount_price);
              const discount = getDiscountPercent(p.price, p.discount_price);
              const isOut =
                p.stock_status === 'out_of_stock' ||
                (typeof p.stock_qty === 'number' && p.stock_qty <= 0);
              const inCart = cart.some((c) => c.product.id === p.id);
              const img =
                p.images?.[0] ||
                'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

              return (
                <Card
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-foreground/30 hover:shadow-md"
                >
                  <Link
                    href={`/product/${p.id}`}
                    className="relative block aspect-square overflow-hidden bg-muted/20"
                  >
                    <Image
                      src={img}
                      alt={p.name}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {discount > 0 && (
                      <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground text-[10px] font-black">
                        -{discount}%
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWishlist(p.id);
                        toast.success('Removed from wishlist');
                      }}
                      aria-label={`Remove ${p.name} from wishlist`}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/95 text-rose-500 shadow-sm hover:bg-destructive hover:text-white transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isOut && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/75 backdrop-blur-sm">
                        <Badge variant="destructive" className="text-[10px] font-bold uppercase">
                          Out of Stock
                        </Badge>
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <div className="mb-1 flex items-center justify-between gap-1 text-[10px]">
                      <Badge
                        variant="secondary"
                        className={
                          isOut
                            ? 'bg-destructive/15 text-destructive text-[10px]'
                            : p.stock_status === 'limited'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px]'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]'
                        }
                      >
                        {isOut
                          ? 'Out of Stock'
                          : p.stock_status === 'limited'
                            ? 'Limited Stock'
                            : 'In Stock'}
                      </Badge>
                      <span className="truncate font-medium text-muted-foreground">
                        {p.brand?.name || 'Local'}
                      </span>
                    </div>

                    <Link
                      href={`/product/${p.id}`}
                      className="line-clamp-2 text-xs sm:text-sm font-bold text-foreground hover:underline leading-snug"
                    >
                      {p.name}
                    </Link>

                    <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm sm:text-base font-black text-foreground">
                        {formatINR(price)}
                      </span>
                      {discount > 0 && (
                        <span className="text-[11px] text-muted-foreground line-through">
                          {formatINR(p.price)}
                        </span>
                      )}
                    </div>

                    {p.dealer && (
                      <div className="mt-2 flex items-center gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                        <Store className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate">{p.dealer.shop_name}</span>
                      </div>
                    )}

                    <div className="mt-auto pt-3 flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isOut}
                        onClick={() => handleMoveToCart(p)}
                        className="h-8 flex-1 rounded-xl text-[11px] font-bold"
                        variant={inCart ? 'secondary' : 'default'}
                      >
                        {inCart ? (
                          <>
                            <Check className="mr-1 h-3.5 w-3.5" /> In Cart
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="mr-1 h-3.5 w-3.5" /> Add to Cart
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          toggleWishlist(p.id);
                          toast.success('Removed from wishlist');
                        }}
                        className="h-8 px-2.5 rounded-xl text-[11px] text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${p.name}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
