'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  GitCompare,
  MapPin,
  PackageOpen,
  Plus,
  Search,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { fetchApprovedDealers, fetchProductById, fetchProducts } from '@/lib/data';
import { formatINR as formatPrice, getDiscountPercent as discountPercent } from '@/lib/format';
import { useApp } from '@/lib/providers';
import type { Dealer, Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function effectivePrice(p: Product): number {
  return p.discount_price && p.discount_price > 0 && p.discount_price < p.price
    ? p.discount_price
    : p.price;
}

export function CompareClient() {
  const { compare, toggleCompare, clearCompare } = useApp();

  const [urlIds, setUrlIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dealerMap, setDealerMap] = useState<Record<string, Dealer>>({});
  const [loading, setLoading] = useState(true);

  // Add Product Picker Dialog State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  // Read optional ?ids=id1,id2 query parameter cleanly on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = new URLSearchParams(window.location.search).get('ids');
    if (raw) {
      const parsed = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      setUrlIds(parsed);
    }
  }, []);

  const activeIds = useMemo(() => {
    const merged: string[] = [];
    for (const id of [...compare, ...urlIds]) {
      if (id && !merged.includes(id) && merged.length < 4) {
        merged.push(id);
      }
    }
    return merged;
  }, [compare, urlIds]);

  useEffect(() => {
    let active = true;
    async function loadComparedProducts() {
      if (activeIds.length === 0) {
        if (active) {
          setProducts([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const [resolvedItems, dealers] = await Promise.all([
          Promise.all(activeIds.map((id) => fetchProductById(id))),
          fetchApprovedDealers(200),
        ]);
        if (!active) return;

        const dMap: Record<string, Dealer> = {};
        for (const d of dealers) dMap[d.id] = d;
        setDealerMap(dMap);

        const valid = resolvedItems.filter((p): p is Product => Boolean(p));
        setProducts(valid);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadComparedProducts();
    return () => {
      active = false;
    };
  }, [activeIds]);

  const openPicker = async () => {
    setPickerOpen(true);
    if (catalogProducts.length > 0) return;
    setCatalogLoading(true);
    try {
      const all = await fetchProducts({ limit: 150 });
      setCatalogProducts(all);
    } catch {
      setCatalogProducts([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleSelectProduct = (id: string) => {
    if (activeIds.includes(id)) {
      if (compare.includes(id)) toggleCompare(id);
      setUrlIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    if (activeIds.length >= 4) return;
    if (!compare.includes(id)) {
      toggleCompare(id);
    }
  };

  const handleRemoveProduct = (id: string) => {
    if (compare.includes(id)) {
      toggleCompare(id);
    }
    setUrlIds((prev) => prev.filter((x) => x !== id));
  };

  const handleClearAll = () => {
    clearCompare();
    setUrlIds([]);
  };

  const filteredCatalog = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return catalogProducts.slice(0, 30);
    return catalogProducts
      .filter((p) => {
        const name = (p.name || p.title || '').toLowerCase();
        const brand = (p.brand?.name || '').toLowerCase();
        const model = (p.model || '').toLowerCase();
        const cat = (p.category?.name || '').toLowerCase();
        return name.includes(q) || brand.includes(q) || model.includes(q) || cat.includes(q);
      })
      .slice(0, 30);
  }, [catalogProducts, pickerQuery]);

  // Price comparisons across current products
  const minEffectivePrice = useMemo(() => {
    if (products.length === 0) return 0;
    return Math.min(...products.map(effectivePrice));
  }, [products]);

  const specKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of products) {
      if (p.specifications && typeof p.specifications === 'object') {
        Object.keys(p.specifications).forEach((k) => {
          if (k.trim()) keys.add(k);
        });
      }
    }
    return Array.from(keys);
  }, [products]);

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Profile</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Compare Products
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Compare up to 4 real catalog products side-by-side by local price, stock, and specifications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {products.length < 4 && (
              <Button
                type="button"
                size="sm"
                onClick={openPicker}
                className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs gap-1.5 px-3.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Product</span>
              </Button>
            )}
            {products.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-9 rounded-xl text-xs font-semibold gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All</span>
              </Button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="h-64 rounded-2xl border border-border bg-card animate-pulse" />
        ) : products.length === 0 ? (
          /* Clean Empty State */
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border">
              <GitCompare className="h-6 w-6 text-foreground" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                No Products Selected to Compare
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Add any products from the marketplace catalog to compare dealer prices, discounts, warranty terms, and specs side-by-side.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <Button
                type="button"
                onClick={openPicker}
                className="h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs gap-1.5 px-5"
              >
                <Plus className="h-4 w-4" />
                <span>Add Product to Compare</span>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-xl text-xs font-semibold px-4">
                <Link href="/categories">Browse Categories</Link>
              </Button>
            </div>
          </div>
        ) : (
          /* Side-by-Side Responsive Table */
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-10 w-40 sm:w-48 bg-card p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground align-top border-r border-border">
                      Product Overview
                    </th>
                    {products.map((p) => {
                      const imgSrc = p.images?.[0] || '/placeholder.png';
                      const finalPrice = effectivePrice(p);
                      const diff = finalPrice - minEffectivePrice;
                      const pctOff = discountPercent(p.price, p.discount_price);

                      return (
                        <th key={p.id} className="w-56 sm:w-64 p-4 align-top border-r last:border-r-0 border-border">
                          <div className="relative space-y-2.5">
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(p.id)}
                              aria-label={`Remove ${p.name}`}
                              className="absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>

                            <Link
                              href={`/product/${p.id}`}
                              className="relative block h-32 w-full overflow-hidden rounded-xl border border-border bg-muted"
                            >
                              <Image
                                src={imgSrc}
                                alt={p.name || 'Product'}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            </Link>

                            <Link
                              href={`/product/${p.id}`}
                              className="block text-sm font-bold text-foreground hover:underline line-clamp-2 min-h-[2.5rem]"
                            >
                              {p.name || p.title}
                            </Link>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-baseline gap-1.5">
                                <span className="text-base font-black text-foreground">
                                  {formatPrice(finalPrice)}
                                </span>
                                {pctOff > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground line-through">
                                      {formatPrice(p.price)}
                                    </span>
                                    <Badge variant="secondary" className="text-[10px] font-bold">
                                      {pctOff}% off
                                    </Badge>
                                  </>
                                )}
                              </div>

                              {products.length > 1 && (
                                <div>
                                  {diff <= 0 ? (
                                    <Badge className="text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-600">
                                      Best Value (Lowest Price)
                                    </Badge>
                                  ) : (
                                    <span className="inline-block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                      +{formatPrice(diff)} higher
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border text-xs sm:text-sm">
                  <tr>
                    <td className="sticky left-0 z-10 bg-card p-3.5 font-semibold text-muted-foreground border-r border-border">
                      Stock Status
                    </td>
                    {products.map((p) => {
                      const inStock = p.stock_status !== 'out_of_stock' && (p.stock_qty ?? 1) > 0;
                      return (
                        <td key={p.id} className="p-3.5 border-r last:border-r-0 border-border">
                          <span
                            className={
                              inStock
                                ? 'inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
                                : 'inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive'
                            }
                          >
                            {p.stock_status === 'out_of_stock'
                              ? 'Out of Stock'
                              : p.stock_status === 'limited'
                                ? `Limited (${p.stock_qty ?? 1})`
                                : `In Stock${p.stock_qty ? ` (${p.stock_qty})` : ''}`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="sticky left-0 z-10 bg-card p-3.5 font-semibold text-muted-foreground border-r border-border">
                      Local Shop
                    </td>
                    {products.map((p) => {
                      const d = p.dealer || (p.dealer_id ? dealerMap[p.dealer_id] : undefined);
                      return (
                        <td key={p.id} className="p-3.5 border-r last:border-r-0 border-border">
                          {d ? (
                            <div className="space-y-0.5">
                              <Link
                                href={`/dealer/${d.id}`}
                                className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
                              >
                                <Store className="h-3.5 w-3.5 shrink-0" />
                                <span>{d.shop_name}</span>
                              </Link>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>
                                  {d.city}
                                  {d.pin_code ? ` (${d.pin_code})` : ''}
                                </span>
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Authorized Store</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="sticky left-0 z-10 bg-card p-3.5 font-semibold text-muted-foreground border-r border-border">
                      Fulfillment
                    </td>
                    {products.map((p) => (
                      <td key={p.id} className="p-3.5 border-r last:border-r-0 border-border">
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {p.delivery_available && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium">
                              <Truck className="h-3 w-3" /> Delivery
                            </span>
                          )}
                          {p.pickup_available && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium">
                              Store Pickup
                            </span>
                          )}
                          {!p.delivery_available && !p.pickup_available && (
                            <span className="text-muted-foreground">Check with store</span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="sticky left-0 z-10 bg-card p-3.5 font-semibold text-muted-foreground border-r border-border">
                      Warranty
                    </td>
                    {products.map((p) => (
                      <td key={p.id} className="p-3.5 border-r last:border-r-0 border-border text-foreground">
                        {p.warranty || p.warranty_info || 'Standard store warranty'}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="sticky left-0 z-10 bg-card p-3.5 font-semibold text-muted-foreground border-r border-border">
                      Brand / Model
                    </td>
                    {products.map((p) => (
                      <td key={p.id} className="p-3.5 border-r last:border-r-0 border-border text-foreground">
                        {[p.brand?.name, p.model || p.model_number].filter(Boolean).join(' • ') || '—'}
                      </td>
                    ))}
                  </tr>

                  {products.some((p) => p.color || p.size || p.material) && (
                    <tr>
                      <td className="sticky left-0 z-10 bg-card p-3.5 font-semibold text-muted-foreground border-r border-border">
                        Variant / Build
                      </td>
                      {products.map((p) => (
                        <td key={p.id} className="p-3.5 border-r last:border-r-0 border-border text-foreground">
                          {[p.color, p.size, p.material].filter(Boolean).join(', ') || '—'}
                        </td>
                      ))}
                    </tr>
                  )}

                  {specKeys.map((specKey) => (
                    <tr key={specKey}>
                      <td className="sticky left-0 z-10 bg-card p-3.5 font-semibold text-muted-foreground capitalize border-r border-border">
                        {specKey.replace(/_/g, ' ')}
                      </td>
                      {products.map((p) => (
                        <td key={p.id} className="p-3.5 border-r last:border-r-0 border-border text-foreground">
                          {p.specifications?.[specKey] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Product to Compare</DialogTitle>
            <DialogDescription className="text-xs">
              Select up to 4 catalog products ({activeIds.length}/4 selected).
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search products by name, model, or category..."
              className="h-10 pl-9 text-sm rounded-xl"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[50vh]">
            {catalogLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Loading catalog products...</div>
            ) : filteredCatalog.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <PackageOpen className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">No matching products found.</p>
              </div>
            ) : (
              filteredCatalog.map((p) => {
                const selected = activeIds.includes(p.id);
                const disabledAdd = !selected && activeIds.length >= 4;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabledAdd}
                    onClick={() => handleSelectProduct(p.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-2.5 text-left hover:bg-muted/60 disabled:opacity-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        <Image
                          src={p.images?.[0] || '/placeholder.png'}
                          alt={p.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {formatPrice(effectivePrice(p))}
                          {p.category?.name ? ` • ${p.category.name}` : ''}
                        </p>
                      </div>
                    </div>

                    <span
                      className={
                        selected
                          ? 'inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shrink-0'
                          : 'inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground shrink-0'
                      }
                    >
                      {selected ? (
                        <>
                          <Check className="h-3 w-3" /> Selected
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" /> Add
                        </>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
