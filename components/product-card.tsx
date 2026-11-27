'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, MapPin, Zap, Scale, ShoppingCart, Check, Store } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { formatINR, getEffectivePrice, getDiscountPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { toast } from 'sonner';

const stockStyles: Record<string, { labelKey: string; defaultLabel: string; className: string; dot: string }> = {
  in_stock: {
    labelKey: 'inStock',
    defaultLabel: 'In Stock',
    className: 'text-foreground bg-muted font-bold',
    dot: 'bg-foreground',
  },
  limited: {
    labelKey: 'limitedStock',
    defaultLabel: 'Limited Stock',
    className: 'text-foreground bg-secondary font-bold',
    dot: 'bg-muted-foreground',
  },
  out_of_stock: {
    labelKey: 'outOfStock',
    defaultLabel: 'Out of Stock',
    className: 'text-muted-foreground bg-muted/60 font-semibold',
    dot: 'bg-muted-foreground',
  },
  restocking: {
    labelKey: 'restocking',
    defaultLabel: 'Restocking Soon',
    className: 'text-muted-foreground bg-muted/40 font-semibold',
    dot: 'bg-muted-foreground',
  },
};

export function ProductCard({ product, distanceKm }: { product: Product; distanceKm?: number }) {
  const router = useRouter();
  const { customer, role } = useAuth();
  const { wishlist, toggleWishlist, compare, toggleCompare, addToCart, cart, t } = useApp();
  const price = getEffectivePrice(product.price, product.discount_price);
  const discount = getDiscountPercent(product.price, product.discount_price);
  const stock = stockStyles[product.stock_status] ?? stockStyles.in_stock;
  const inWishlist = wishlist.includes(product.id);
  const inCompare = compare.includes(product.id);
  const inCart = cart.some((item) => item.product.id === product.id);
  const image =
    product.images[0] ??
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!customer && role !== 'customer') {
      toast.error('Please login to add items to your cart');
      router.push(`/customer/login?redirect=/product/${product.id}`);
      return;
    }
    addToCart(product, 1);
    toast.success(`${product.name.slice(0, 24)}... added to Cart!`);
  };

  const stockLabel = t(stock.labelKey) || stock.defaultLabel;

  return (
    <Card className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground transition-all duration-300 hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg">
      {/* Product Image Box */}
      <Link href={`/product/${product.id}`} className="relative block aspect-square overflow-hidden bg-muted/20">
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Badges */}
        <div className="absolute left-2.5 top-2.5 flex flex-col gap-1 z-10">
          {discount > 0 && (
            <Badge className="bg-primary text-primary-foreground font-black shadow-sm">
              -{discount}%
            </Badge>
          )}
          {product.is_trending && (
            <Badge className="bg-card text-card-foreground border border-border font-bold shadow-sm">
              <Zap className="mr-1 h-3 w-3 fill-current text-foreground" /> {t('trending')}
            </Badge>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          className={cn(
            'absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 shadow-sm',
            inWishlist
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/90 text-foreground hover:bg-card border border-border'
          )}
          aria-label="Toggle wishlist"
        >
          <Heart className={cn('h-4 w-4', inWishlist && 'fill-current text-primary-foreground')} />
        </button>

        {product.stock_status === 'out_of_stock' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <Badge className="bg-destructive text-destructive-foreground text-xs font-black uppercase">
              {stockLabel}
            </Badge>
          </div>
        )}
      </Link>

      {/* Content Details */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center justify-between gap-1 text-[11px]">
          <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', stock.className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', stock.dot)} />
            {stockLabel}
          </span>
          <span className="text-muted-foreground truncate font-semibold">{product.brand?.name || 'Local'}</span>
        </div>

        <Link
          href={`/product/${product.id}`}
          className="line-clamp-2 text-xs sm:text-sm font-bold text-foreground leading-snug hover:underline transition-colors"
          title={product.name}
        >
          {product.name}
        </Link>

        {/* Pricing */}
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-base sm:text-lg font-black text-foreground">{formatINR(price)}</span>
          {discount > 0 && (
            <span className="text-xs text-muted-foreground line-through font-semibold">{formatINR(product.price)}</span>
          )}
        </div>

        {/* Dealer Shop Name & Distance */}
        {product.dealer && (
          <div className="mt-2.5 flex items-center gap-1 text-xs text-muted-foreground border-t border-border pt-2 font-medium">
            <MapPin className="h-3.5 w-3.5 text-foreground shrink-0" />
            <span className="truncate">{product.dealer.shop_name}</span>
            {distanceKm !== undefined && (
              <span className="ml-auto shrink-0 font-bold text-foreground">{distanceKm.toFixed(1)} km</span>
            )}
          </div>
        )}

        <Link
          href={`/product/${product.id}#available-shops`}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:underline transition-colors"
        >
          <Store className="h-3 w-3" />
          <span>Available in multiple showrooms &rarr;</span>
        </Link>

        {/* Interactive Action Buttons */}
        <div className="mt-3.5 flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleAddToCart}
            className={cn(
              'h-8 flex-1 text-xs font-bold rounded-xl transition-all',
              inCart
                ? 'bg-muted text-foreground border border-border hover:bg-muted/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            disabled={product.stock_status === 'out_of_stock'}
          >
            {inCart ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" /> {t('inCart')}
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1 h-3.5 w-3.5" /> {t('addToCart')}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 px-2.5 text-xs rounded-xl border border-border transition-all',
              inCompare
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-foreground hover:bg-muted'
            )}
            onClick={(e) => {
              e.preventDefault();
              toggleCompare(product.id);
            }}
            title={inCompare ? 'Remove from comparison' : 'Compare product'}
          >
            <Scale className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
