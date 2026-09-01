'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, MapPin, Zap, Check, Clock, Scale } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/providers';
import { formatINR, getEffectivePrice, getDiscountPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/supabase';

const stockStyles: Record<string, { label: string; className: string; dot: string }> = {
  in_stock: { label: 'In Stock', className: 'text-success bg-success/10', dot: 'bg-success' },
  limited: { label: 'Limited', className: 'text-warning bg-warning/10', dot: 'bg-warning' },
  out_of_stock: { label: 'Out of Stock', className: 'text-destructive bg-destructive/10', dot: 'bg-destructive' },
  restocking: { label: 'Restocking', className: 'text-muted-foreground bg-muted', dot: 'bg-muted-foreground' },
};

export function ProductCard({ product, distanceKm }: { product: Product; distanceKm?: number }) {
  const { wishlist, toggleWishlist, compare, toggleCompare, t } = useApp();
  const price = getEffectivePrice(product.price, product.discount_price);
  const discount = getDiscountPercent(product.price, product.discount_price);
  const stock = stockStyles[product.stock_status] ?? stockStyles.in_stock;
  const inWishlist = wishlist.includes(product.id);
  const inCompare = compare.includes(product.id);
  const image = product.images[0] ?? 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=600';

  return (
    <Card className="group relative flex flex-col overflow-hidden border-border/60 transition-all hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/product/${product.id}`} className="relative block aspect-square overflow-hidden bg-muted">
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {discount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground shadow-sm">-{discount}%</Badge>
          )}
          {product.is_trending && (
            <Badge className="bg-warning text-warning-foreground shadow-sm"><Zap className="mr-1 h-3 w-3" />Trending</Badge>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
          className={cn(
            'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition-colors',
            inWishlist ? 'bg-destructive text-destructive-foreground' : 'bg-background/80 text-foreground hover:bg-background'
          )}
          aria-label="Toggle wishlist"
        >
          <Heart className={cn('h-4 w-4', inWishlist && 'fill-current')} />
        </button>
        {product.stock_status === 'out_of_stock' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Badge variant="secondary" className="text-sm">{stock.label}</Badge>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', stock.className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', stock.dot)} />
            {product.stock_status === 'in_stock' ? `In Stock (${product.stock_qty})` : stock.label}
          </span>
        </div>
        <Link href={`/product/${product.id}`} className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary">
          {product.name}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">{product.brand?.name ?? 'Local'} · {product.category?.name ?? 'General'}</p>

        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-base font-bold text-foreground">{formatINR(price)}</span>
          {discount > 0 && <span className="text-xs text-muted-foreground line-through">{formatINR(product.price)}</span>}
        </div>

        {product.dealer && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="truncate">{product.dealer.shop_name}</span>
            {distanceKm !== undefined && (
              <span className="ml-auto shrink-0 font-medium text-foreground">{distanceKm.toFixed(1)} km</span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant={inCompare ? 'default' : 'outline'}
            size="sm"
            className="h-8 flex-1 text-xs"
            onClick={(e) => { e.preventDefault(); toggleCompare(product.id); }}
          >
            <Scale className="mr-1 h-3 w-3" /> {t('compare')}
          </Button>
          <Button asChild size="sm" className="h-8 flex-1 text-xs">
            <Link href={`/product/${product.id}`}>{t('viewDetails')}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
