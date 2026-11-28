'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  Package,
  Search,
  Plus,
  Check,
  Loader2,
  ShoppingCart,
  Tag,
  Eye,
  Clock,
  Sparkles,
  FilePlus2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImagePicker } from '@/components/ui/image-picker';
import { formatINR, getEffectivePrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Product, Category, Brand, Dealer } from '@/lib/types';
import { apiSync } from '@/lib/api-sync';
import {
  getDbBrands,
  getDbCategories,
  getDbProducts,
  saveDbProduct,
} from '@/lib/firebase-db';
import { useRealtimeSync } from '@/lib/realtime-client';

export function DealerCatalogClient({
  dealer,
  onInventoryChanged,
  initialMode = 'catalogue',
}: {
  dealer: Dealer;
  onInventoryChanged?: () => Promise<void> | void;
  initialMode?: 'catalogue' | 'request';
}) {
  const [mode, setMode] = useState<'catalogue' | 'request'>(initialMode);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [dealerProducts, setDealerProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preview dialog & Quick Add dialog
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [addTarget, setAddTarget] = useState<Product | null>(null);
  const [addPrice, setAddPrice] = useState('');
  const [addDiscount, setAddDiscount] = useState('');
  const [addStockQty, setAddStockQty] = useState('10');
  const [addDelivery, setAddDelivery] = useState(dealer.delivery_available ?? true);
  const [addPickup, setAddPickup] = useState(dealer.pickup_available ?? true);
  const [submittingCatalogue, setSubmittingCatalogue] = useState(false);

  // Custom / Request New Product Form
  const [reqName, setReqName] = useState('');
  const [reqBrandId, setReqBrandId] = useState('');
  const [reqCustomBrand, setReqCustomBrand] = useState('');
  const [reqCategoryId, setReqCategoryId] = useState('');
  const [reqModel, setReqModel] = useState('');
  const [reqPrice, setReqPrice] = useState('');
  const [reqDiscount, setReqDiscount] = useState('');
  const [reqStockQty, setReqStockQty] = useState('10');
  const [reqImage, setReqImage] = useState('');
  const [reqWarranty, setReqWarranty] = useState('1 Year Brand Warranty');
  const [reqColor, setReqColor] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqSpecsText, setReqSpecsText] = useState('');
  const [reqDelivery, setReqDelivery] = useState(dealer.delivery_available ?? true);
  const [reqPickup, setReqPickup] = useState(dealer.pickup_available ?? true);
  const [submittingCustom, setSubmittingCustom] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [masterList, myList, cats, brnds] = await Promise.all([
        apiSync.fetchProducts({ masterOnly: true }),
        getDbProducts({ dealerId: dealer.id, includeUnapproved: true }),
        getDbCategories(),
        getDbBrands(),
      ]);

      const catMap = new Map(cats.map((c) => [c.id, c]));
      const brandMap = new Map(brnds.map((b) => [b.id, b]));
      const enrichedMaster = masterList.map((p) => ({
        ...p,
        category: p.category ?? (p.category_id ? catMap.get(p.category_id) ?? null : null),
        brand: p.brand ?? (p.brand_id ? brandMap.get(p.brand_id) ?? null : null),
      }));

      setCatalog(enrichedMaster);
      setDealerProducts(myList);
      setCategories(cats);
      setBrands(brnds);
      if (!reqCategoryId && cats.length > 0) {
        setReqCategoryId(cats[0].id);
      }
      if (!reqBrandId && brnds.length > 0) {
        setReqBrandId(brnds[0].id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load catalogue';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [dealer.id, reqCategoryId, reqBrandId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(['products', 'categories', 'brands'], () => load(), {
    enabled: Boolean(dealer.id),
  });

  // Map master IDs and normalized names already in this dealer's showroom to prevent duplicates
  const ownedLookup = useMemo(() => {
    const masterMap = new Map<string, Product>();
    const nameMap = new Map<string, Product>();
    for (const p of dealerProducts) {
      if (p.master_product_id) masterMap.set(p.master_product_id, p);
      const prefix = `prod-${dealer.id}-`;
      if (p.id.startsWith(prefix)) {
        masterMap.set(p.id.slice(prefix.length), p);
      }
      if (p.is_master && p.dealer_id === dealer.id) {
        masterMap.set(p.id, p);
      }
      nameMap.set(p.name.trim().toLowerCase(), p);
    }
    return { masterMap, nameMap };
  }, [dealerProducts, dealer.id]);

  const getExistingOwnedListing = useCallback(
    (master: Product): Product | undefined => {
      return (
        ownedLookup.masterMap.get(master.id) ||
        ownedLookup.nameMap.get(master.name.trim().toLowerCase())
      );
    },
    [ownedLookup]
  );

  const rootCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  const filteredCatalog = useMemo(() => {
    return catalog.filter((p) => {
      if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;
      if (filterBrand !== 'all' && p.brand_id !== filterBrand) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          p.name,
          p.brand?.name || p.brand_name || '',
          p.category?.name || '',
          p.model || '',
          p.model_number || '',
          ...(p.tags || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [catalog, search, filterCategory, filterBrand]);

  const openAddDialog = (master: Product) => {
    if (getExistingOwnedListing(master)) {
      toast.info(`"${master.name}" is already in your shop.`);
      return;
    }
    setAddTarget(master);
    setAddPrice(String(master.price || 999));
    setAddDiscount(master.discount_price ? String(master.discount_price) : '');
    setAddStockQty('10');
    setAddDelivery(dealer.delivery_available ?? true);
    setAddPickup(dealer.pickup_available ?? true);
  };

  const handleConfirmAddToShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTarget) return;

    const priceVal = Number(addPrice);
    const discountVal = addDiscount ? Number(addDiscount) : null;
    const stockVal = Math.max(0, Math.floor(Number(addStockQty) || 0));

    if (!Number.isFinite(priceVal) || priceVal <= 0) {
      toast.error('Please enter a valid positive selling price.');
      return;
    }
    if (discountVal !== null && (!Number.isFinite(discountVal) || discountVal <= 0 || discountVal >= priceVal)) {
      toast.error('Discount offer price must be positive and less than MRP.');
      return;
    }

    setSubmittingCatalogue(true);
    try {
      const saved = await saveDbProduct({
        id: `prod-${dealer.id}-${addTarget.id}`,
        dealer_id: dealer.id,
        master_product_id: addTarget.id,
        from_catalogue: true,
        name: addTarget.name,
        brand_id: addTarget.brand_id,
        brand_name: addTarget.brand?.name || addTarget.brand_name || null,
        category_id: addTarget.category_id,
        model: addTarget.model || addTarget.model_number || null,
        description: addTarget.description,
        specifications: addTarget.specifications || {},
        features: addTarget.features || [],
        tags: addTarget.tags || [],
        images: addTarget.images || [],
        warranty: addTarget.warranty || '1 Year Brand Warranty',
        color: addTarget.color || null,
        price: priceVal,
        discount_price: discountVal,
        stock_qty: stockVal,
        stock_quantity: stockVal,
        low_stock_threshold: dealer.low_stock_threshold ?? 5,
        stock_status: stockVal <= 0 ? 'out_of_stock' : stockVal <= (dealer.low_stock_threshold ?? 5) ? 'limited' : 'in_stock',
        delivery_available: addDelivery,
        pickup_available: addPickup,
        is_master: false,
        is_active: true,
        moderation_status: 'pending',
      });

      setDealerProducts((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      setAddTarget(null);
      setPreviewProduct(null);
      const msg = `"${saved.name}" submitted from Catalogue and added to My Products (Pending Admin Approval).`;
      setFeedback({ type: 'success', text: msg });
      toast.success(msg);
      if (onInventoryChanged) await onInventoryChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add product to shop';
      setFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSubmittingCatalogue(false);
    }
  };

  const handleSubmitNewProductRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = reqName.trim();
    const priceVal = Number(reqPrice);
    const discountVal = reqDiscount ? Number(reqDiscount) : null;
    const stockVal = Math.max(0, Math.floor(Number(reqStockQty) || 0));

    if (cleanName.length < 2) {
      toast.error('Please enter a valid product name.');
      return;
    }
    if (!Number.isFinite(priceVal) || priceVal <= 0) {
      toast.error('Please enter a positive selling price.');
      return;
    }
    if (discountVal !== null && (!Number.isFinite(discountVal) || discountVal <= 0 || discountVal >= priceVal)) {
      toast.error('Discount offer price must be less than MRP.');
      return;
    }

    // Parse key: value specs lines
    const parsedSpecs: Record<string, string> = {};
    if (reqWarranty.trim()) parsedSpecs['Warranty'] = reqWarranty.trim();
    if (reqColor.trim()) parsedSpecs['Color'] = reqColor.trim();
    for (const line of reqSpecsText.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k && v) parsedSpecs[k] = v;
      }
    }

    const isOtherBrand = reqBrandId === '__custom__';
    const selectedBrandObj = !isOtherBrand ? brands.find((b) => b.id === reqBrandId) : null;
    const brandName = isOtherBrand ? reqCustomBrand.trim() : selectedBrandObj?.name || null;

    setSubmittingCustom(true);
    try {
      const saved = await saveDbProduct({
        dealer_id: dealer.id,
        name: cleanName,
        brand_id: isOtherBrand ? null : (reqBrandId || null),
        brand_name: brandName,
        category_id: reqCategoryId || (categories[0]?.id ?? 'cat-electronics'),
        model: reqModel.trim() || null,
        price: priceVal,
        discount_price: discountVal,
        stock_qty: stockVal,
        stock_quantity: stockVal,
        low_stock_threshold: dealer.low_stock_threshold ?? 5,
        stock_status: stockVal <= 0 ? 'out_of_stock' : stockVal <= (dealer.low_stock_threshold ?? 5) ? 'limited' : 'in_stock',
        description: reqDescription.trim() || `${cleanName} available at ${dealer.shop_name}.`,
        specifications: parsedSpecs,
        images: reqImage.trim()
          ? [reqImage.trim()]
          : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
        warranty: reqWarranty.trim() || null,
        color: reqColor.trim() || null,
        delivery_available: reqDelivery,
        pickup_available: reqPickup,
        is_master: false,
        is_active: true,
        moderation_status: 'pending',
      });

      setDealerProducts((prev) => [saved, ...prev]);
      setReqName('');
      setReqModel('');
      setReqPrice('');
      setReqDiscount('');
      setReqStockQty('10');
      setReqImage('');
      setReqColor('');
      setReqDescription('');
      setReqSpecsText('');
      setReqCustomBrand('');

      const msg = `"${saved.name}" submitted for Admin review! Once approved, it will go live in the Customer App.`;
      setFeedback({ type: 'success', text: msg });
      toast.success(msg);
      if (onInventoryChanged) await onInventoryChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit new product';
      setFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSubmittingCustom(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          data-testid="dealer-catalog-feedback"
          className={cn(
            'rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2',
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {feedback.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'catalogue' | 'request')}>
        <TabsList className="grid w-full max-w-xl grid-cols-2 h-10 p-1 bg-muted/60">
          <TabsTrigger value="catalogue" className="text-xs font-bold gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" /> Add Products from Catalogue ({catalog.length})
          </TabsTrigger>
          <TabsTrigger value="request" className="text-xs font-bold gap-1.5">
            <FilePlus2 className="h-3.5 w-3.5 text-primary" /> Request New Product
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ADD PRODUCTS FROM CATALOGUE */}
        <TabsContent value="catalogue" className="mt-4 space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  Add Products from Catalogue
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Browse Admin-approved master products, preview full specs, set your showroom selling price &amp; stock, and submit to your shop.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMode('request')}
              className="text-xs font-semibold shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Not listed? Request New Product
            </Button>
          </div>

          {/* Search + Brand filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalogue by product name, brand, category, model..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Brands ({brands.length})</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filterCategory === 'all'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border/60 hover:bg-muted/50'
              )}
            >
              All Categories
            </button>
            {rootCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilterCategory(c.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filterCategory === c.id
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-border/60 hover:bg-muted/50'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {filteredCatalog.length === 0 ? (
            <Card className="p-10 text-center space-y-3">
              <Package className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
              <div>
                <p className="font-bold text-sm text-foreground">No Matching Catalogue Products</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cannot find the product you carry? Submit a custom product request directly to Admin for approval.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  if (search.trim()) setReqName(search.trim());
                  setMode('request');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <FilePlus2 className="h-3.5 w-3.5 mr-1.5" /> Request New Product
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCatalog.map((product) => {
                const owned = getExistingOwnedListing(product);
                const specPairs = Object.entries(product.specifications || {}).slice(0, 2);

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      'p-3.5 flex flex-col justify-between gap-3 border transition-all',
                      owned
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border/80 hover:border-primary/40'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/50">
                        {product.images?.[0] ? (
                          <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="line-clamp-2 text-xs sm:text-sm font-bold text-foreground leading-snug">
                          {product.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/80">
                            {product.brand?.name || product.brand_name || 'Brand'}
                          </span>
                          <span>•</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {product.category?.name || 'General'}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          Ref Price: {formatINR(getEffectivePrice(product.price, product.discount_price))}
                        </p>
                      </div>
                    </div>

                    {specPairs.length > 0 && (
                      <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground space-y-0.5">
                        {specPairs.map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-2 truncate">
                            <span className="font-medium text-foreground/70">{k}:</span>
                            <span className="truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewProduct(product)}
                        className="h-8 px-2.5 text-xs font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                      </Button>

                      {owned ? (
                        <Badge
                          className={cn(
                            'text-[10px] font-bold gap-1',
                            owned.moderation_status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : owned.moderation_status === 'rejected'
                                ? 'bg-rose-500/15 text-rose-700 border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                          )}
                        >
                          {owned.moderation_status === 'approved' ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          In Shop ({owned.moderation_status})
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openAddDialog(product)}
                          className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add to My Shop
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: REQUEST / SUBMIT NEW PRODUCT */}
        <TabsContent value="request" className="mt-4">
          <Card className="p-5 border-border/80 max-w-3xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" /> Request / Submit New Product
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Submit a custom showroom product not listed in the Master Catalogue. Submissions enter Pending Approval until reviewed by an Admin.
                </p>
              </div>
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] shrink-0">
                Requires Admin Approval
              </Badge>
            </div>

            <form onSubmit={handleSubmitNewProductRequest} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-bold">Product Name *</Label>
                  <Input
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="e.g. Samsung Odyssey G7 32-inch Gaming Monitor"
                    className="mt-1 h-9 text-xs"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">Category *</Label>
                  <Select value={reqCategoryId} onValueChange={setReqCategoryId}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold">Brand *</Label>
                  <Select value={reqBrandId} onValueChange={setReqBrandId}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__" className="text-xs font-semibold text-emerald-600">
                        + Other / Enter Brand Name
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reqBrandId === '__custom__' && (
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-bold">Brand Name *</Label>
                    <Input
                      value={reqCustomBrand}
                      onChange={(e) => setReqCustomBrand(e.target.value)}
                      placeholder="Enter brand name (e.g. Nothing, Dyson, Asus)"
                      className="mt-1 h-9 text-xs"
                      required
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs font-bold">MRP / Regular Price (₹) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={reqPrice}
                    onChange={(e) => setReqPrice(e.target.value)}
                    placeholder="e.g. 42990"
                    className="mt-1 h-9 text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">Special Selling Price (₹ optional)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={reqDiscount}
                    onChange={(e) => setReqDiscount(e.target.value)}
                    placeholder="Discounted showroom price"
                    className="mt-1 h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">Initial Stock Quantity *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={reqStockQty}
                    onChange={(e) => setReqStockQty(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">Model Number / SKU</Label>
                  <Input
                    value={reqModel}
                    onChange={(e) => setReqModel(e.target.value)}
                    placeholder="e.g. LC32G75TQSWXXL"
                    className="mt-1 h-9 text-xs font-mono"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">Warranty Info</Label>
                  <Input
                    value={reqWarranty}
                    onChange={(e) => setReqWarranty(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">Color / Variant</Label>
                  <Input
                    value={reqColor}
                    onChange={(e) => setReqColor(e.target.value)}
                    placeholder="e.g. Matte Black"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <ImagePicker
                  value={reqImage}
                  onChange={setReqImage}
                  label="Product Photo"
                  description="Upload product photo or paste image URL"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Description</Label>
                <Textarea
                  rows={3}
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="Key highlights, box contents, and showroom availability..."
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Technical Specifications (Optional, Key: Value per line)</Label>
                <Textarea
                  rows={3}
                  value={reqSpecsText}
                  onChange={(e) => setReqSpecsText(e.target.value)}
                  placeholder={'Display: 32-inch QLED QHD\nRefresh Rate: 240Hz\nPorts: HDMI 2.1, DisplayPort'}
                  className="mt-1 text-xs font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-4 p-3 rounded-xl border border-border bg-muted/20">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={reqDelivery}
                    onChange={(e) => setReqDelivery(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-emerald-600"
                  />
                  Home Delivery Available
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={reqPickup}
                    onChange={(e) => setReqPickup(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-emerald-600"
                  />
                  Showroom Pickup Available
                </label>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submittingCustom}
                  className="h-10 px-5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submittingCustom ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1.5" /> Submit Product for Approval
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <Dialog open={!!previewProduct} onOpenChange={(v) => !v && setPreviewProduct(null)}>
        {previewProduct && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-black">{previewProduct.name}</DialogTitle>
              <DialogDescription className="text-xs">
                {previewProduct.brand?.name || 'Brand'} • {previewProduct.category?.name || 'Category'}
                {previewProduct.model ? ` • Model: ${previewProduct.model}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {previewProduct.images?.[0] && (
                <div className="relative h-48 w-full overflow-hidden rounded-xl bg-muted border border-border">
                  <Image
                    src={previewProduct.images[0]}
                    alt={previewProduct.name}
                    fill
                    sizes="420px"
                    className="object-contain p-2"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Catalog Reference MRP</span>
                  <span className="text-base font-black text-foreground">
                    {formatINR(previewProduct.price)}
                  </span>
                </div>
                {previewProduct.warranty && (
                  <Badge variant="outline" className="text-[10px]">
                    {previewProduct.warranty}
                  </Badge>
                )}
              </div>

              {previewProduct.description && (
                <div>
                  <span className="font-bold text-foreground block mb-1">Description</span>
                  <p className="text-muted-foreground leading-relaxed">{previewProduct.description}</p>
                </div>
              )}

              {previewProduct.specifications && Object.keys(previewProduct.specifications).length > 0 && (
                <div>
                  <span className="font-bold text-foreground block mb-1.5">Specifications</span>
                  <div className="rounded-xl border border-border divide-y divide-border/60">
                    {Object.entries(previewProduct.specifications).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 px-3 py-2">
                        <span className="font-semibold text-muted-foreground">{k}</span>
                        <span className="font-medium text-foreground text-right">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPreviewProduct(null)}>
                Close
              </Button>
              {!getExistingOwnedListing(previewProduct) && (
                <Button
                  type="button"
                  onClick={() => openAddDialog(previewProduct)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add to My Shop
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Set Own Price & Stock Dialog for Catalogue Product */}
      <Dialog open={!!addTarget} onOpenChange={(v) => !v && setAddTarget(null)}>
        {addTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-black">
                <Tag className="h-4 w-4 text-emerald-600" /> Add to My Shop
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set your showroom selling price and initial stock for &quot;{addTarget.name}&quot;. It will be submitted for Admin approval.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmAddToShop} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold">Your Selling MRP (₹) *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    className="mt-1 h-9 text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Offer Price (₹ optional)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={addDiscount}
                    onChange={(e) => setAddDiscount(e.target.value)}
                    placeholder="Optional offer price"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Initial Stock Quantity *</Label>
                <Input
                  type="number"
                  min={0}
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                  className="mt-1 h-9 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-4 p-2.5 rounded-xl border border-border bg-muted/20">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={addDelivery}
                    onChange={(e) => setAddDelivery(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-emerald-600"
                  />
                  Home Delivery
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={addPickup}
                    onChange={(e) => setAddPickup(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-emerald-600"
                  />
                  Store Pickup
                </label>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAddTarget(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingCatalogue}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {submittingCatalogue ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add to My Shop
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
