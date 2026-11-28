'use client';

import { DealerCatalogClient } from '@/components/dealer-catalog-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiSync } from '@/lib/api-sync';
import {
  broadcastSync,
  deleteDbProduct,
  getDbBrands,
  getDbCategories,
  saveDbDealer,
  saveDbProduct,
} from '@/lib/firebase-db';
import { formatINR, getDiscountPercent, getEffectivePrice, timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Brand, Category, Dealer, Product } from '@/lib/types';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  HelpCircle,
  History,
  Layers,
  Loader2,
  MessageSquareText,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type SubTabKey = 'all' | 'add' | 'pending' | 'approved' | 'rejected' | 'low_stock';

type Module03Props = {
  dealer: Dealer;
  products: Product[];
  onRefreshProducts: () => Promise<void>;
  onNavigateTab: (tabId: string) => void;
  defaultSubTab?: SubTabKey;
};

export function Module03DealerProducts({
  dealer,
  products,
  onRefreshProducts,
  defaultSubTab = 'all',
}: Module03Props) {
  const [subTab, setSubTab] = useState<SubTabKey>(defaultSubTab);
  const [catalogMode, setCatalogMode] = useState<'catalogue' | 'request'>('catalogue');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStock, setFilterStock] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Configurable low-stock alert threshold
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(
    dealer.low_stock_threshold ?? 5
  );
  const [savingThreshold, setSavingThreshold] = useState(false);

  // Bulk stock update map (productId -> stock string)
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEdits, setBulkEdits] = useState<Record<string, string>>({});
  const [savingBulk, setSavingBulk] = useState(false);

  // Modals
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [viewingRejection, setViewingRejection] = useState<Product | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Product | null>(null);

  // Edit / Resubmit form fields
  const [nameInput, setNameInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [brandInput, setBrandInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [stockQtyInput, setStockQtyInput] = useState('');
  const [lowThresholdInput, setLowThresholdInput] = useState('');
  const [stockStatusInput, setStockStatusInput] = useState<Product['stock_status']>('in_stock');
  const [imageInput, setImageInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [warrantyInput, setWarrantyInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [deliveryInput, setDeliveryInput] = useState(true);
  const [pickupInput, setPickupInput] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSubTab(defaultSubTab);
  }, [defaultSubTab]);

  useEffect(() => {
    setLowStockThreshold(dealer.low_stock_threshold ?? 5);
  }, [dealer.low_stock_threshold]);

  useEffect(() => {
    Promise.all([getDbCategories(), getDbBrands()])
      .then(([cats, brnds]) => {
        setCategories(cats);
        setBrands(brnds);
      })
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let lowOrOut = 0;

    for (const p of products) {
      const mod = p.moderation_status || (p.is_active ? 'approved' : 'pending');
      if (mod === 'pending') pending++;
      else if (mod === 'approved') approved++;
      else if (mod === 'rejected' || mod === 'flagged') rejected++;

      const qty = p.stock_qty ?? 0;
      const itemThresh = p.low_stock_threshold ?? lowStockThreshold;
      if (qty === 0 || p.stock_status === 'out_of_stock' || qty <= itemThresh || p.stock_status === 'limited') {
        lowOrOut++;
      }
    }

    return {
      all: products.length,
      pending,
      approved,
      rejected,
      lowOrOut,
    };
  }, [products, lowStockThreshold]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const mod = p.moderation_status || (p.is_active ? 'approved' : 'pending');
      const qty = p.stock_qty ?? 0;
      const itemThresh = p.low_stock_threshold ?? lowStockThreshold;

      if (subTab === 'pending' && mod !== 'pending') return false;
      if (subTab === 'approved' && mod !== 'approved') return false;
      if (subTab === 'rejected' && mod !== 'rejected' && mod !== 'flagged') return false;
      if (
        subTab === 'low_stock' &&
        qty > 0 &&
        p.stock_status !== 'out_of_stock' &&
        qty > itemThresh &&
        p.stock_status !== 'limited'
      ) {
        return false;
      }

      if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;

      if (filterStock !== 'all') {
        if (filterStock === 'out_of_stock' && qty > 0 && p.stock_status !== 'out_of_stock') return false;
        if (filterStock === 'limited' && (qty === 0 || (qty > itemThresh && p.stock_status !== 'limited'))) return false;
        if (filterStock === 'in_stock' && (qty <= 0 || p.stock_status === 'out_of_stock' || qty <= itemThresh)) return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchBrand = (p.brand?.name || p.brand_name || '').toLowerCase().includes(q);
        const matchCat = (p.category?.name || '').toLowerCase().includes(q);
        const matchModel = (p.model || '').toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchCat && !matchModel) return false;
      }
      return true;
    });
  }, [products, subTab, filterCategory, filterStock, search, lowStockThreshold]);

  const openEditModal = (p: Product, resubmitFlag = false) => {
    setEditingProduct(p);
    setIsResubmitting(resubmitFlag);
    setNameInput(p.name || '');
    setModelInput(p.model || '');
    setCategoryInput(p.category_id || (p.category?.id ?? ''));
    setBrandInput(p.brand_id || '');
    setPriceInput(String(p.price || 0));
    setDiscountInput(p.discount_price ? String(p.discount_price) : '');
    setStockQtyInput(String(p.stock_qty ?? 0));
    setLowThresholdInput(String(p.low_stock_threshold ?? lowStockThreshold));
    setStockStatusInput(p.stock_status || 'in_stock');
    setImageInput(p.images && p.images[0] ? p.images[0] : '');
    setDescriptionInput(p.description || '');
    setWarrantyInput(p.warranty || p.specifications?.['Warranty'] || '1 Year Brand Warranty');
    setColorInput(p.color || p.specifications?.['Color'] || 'Standard');
    setDeliveryInput(p.delivery_available ?? dealer.delivery_available ?? true);
    setPickupInput(p.pickup_available ?? dealer.pickup_available ?? true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const updatedPrice = parseFloat(priceInput);
    const updatedDiscount = discountInput ? parseFloat(discountInput) : null;
    const updatedStockQty = Math.max(0, parseInt(stockQtyInput, 10) || 0);
    const updatedThreshold = Math.max(1, parseInt(lowThresholdInput, 10) || lowStockThreshold);

    if (!Number.isFinite(updatedPrice) || updatedPrice <= 0) {
      toast.error('Selling price must be greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const updated = await saveDbProduct(
        {
          id: editingProduct.id,
          dealer_id: dealer.id,
          name: nameInput.trim() || editingProduct.name,
          model: modelInput.trim() || null,
          category_id: categoryInput || editingProduct.category_id,
          brand_id: brandInput || editingProduct.brand_id,
          price: updatedPrice,
          discount_price: updatedDiscount,
          stock_qty: updatedStockQty,
          stock_quantity: updatedStockQty,
          low_stock_threshold: updatedThreshold,
          stock_status:
            updatedStockQty <= 0
              ? 'out_of_stock'
              : stockStatusInput === 'out_of_stock'
                ? 'out_of_stock'
                : updatedStockQty <= updatedThreshold
                  ? 'limited'
                  : 'in_stock',
          images: imageInput ? [imageInput] : editingProduct.images,
          description: descriptionInput.trim() || editingProduct.description,
          warranty: warrantyInput.trim() || null,
          color: colorInput.trim() || null,
          delivery_available: deliveryInput,
          pickup_available: pickupInput,
          specifications: {
            ...(editingProduct.specifications || {}),
            Warranty: warrantyInput.trim() || 'Standard Warranty',
            Color: colorInput.trim() || 'Standard',
          },
          resubmit: isResubmitting,
        },
        { isUpdate: true }
      );

      broadcastSync('products', updated);
      const msg = isResubmitting
        ? `"${updated.name}" updated and resubmitted for Admin approval!`
        : `"${updated.name}" updated across your showroom!`;
      setFeedback({ type: 'success', text: msg });
      toast.success(msg);
      setEditingProduct(null);
      setIsResubmitting(false);
      await onRefreshProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update product details';
      setFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThreshold = async () => {
    const clean = Math.max(1, Math.floor(Number(lowStockThreshold) || 5));
    setSavingThreshold(true);
    try {
      await saveDbDealer({ ...dealer, low_stock_threshold: clean });
      setLowStockThreshold(clean);
      toast.success(`Low-stock alert threshold saved (≤ ${clean} units).`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save alert threshold');
    } finally {
      setSavingThreshold(false);
    }
  };

  const handleSaveBulkStock = async () => {
    const payload = Object.entries(bulkEdits)
      .filter(([, val]) => val !== '' && Number.isFinite(Number(val)))
      .map(([id, val]) => {
        const qty = Math.max(0, Math.floor(Number(val)));
        return {
          id,
          stock_qty: qty,
          low_stock_threshold: lowStockThreshold,
          stock_status: (qty <= 0 ? 'out_of_stock' : qty <= lowStockThreshold ? 'limited' : 'in_stock') as Product['stock_status'],
        };
      });

    if (payload.length === 0) {
      toast.info('Change at least one stock unit before saving bulk update.');
      return;
    }

    setSavingBulk(true);
    try {
      await apiSync.bulkUpdateProducts(payload);
      broadcastSync('products', { bulk: true });
      setBulkMode(false);
      setBulkEdits({});
      setFeedback({ type: 'success', text: `Bulk updated stock for ${payload.length} product(s).` });
      toast.success(`Updated stock for ${payload.length} product(s).`);
      await onRefreshProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply bulk stock update');
    } finally {
      setSavingBulk(false);
    }
  };

  const handleRemoveFromShop = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from your shop inventory? Master catalog items remain unaffected.`)) return;
    try {
      await deleteDbProduct(id);
      const prefix = `prod-${dealer.id}-`;
      if (id.startsWith(prefix)) {
        const masterId = id.slice(prefix.length);
        await supabase
          .from('dealer_inventory')
          .delete()
          .eq('dealer_id', dealer.id)
          .eq('product_id', masterId);
      }
      broadcastSync('products', { removedId: id });
      setFeedback({ type: 'success', text: `"${name}" removed from your shop inventory.` });
      toast.success('Product removed from your shop.');
      await onRefreshProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove product';
      setFeedback({ type: 'error', text: msg });
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Package className="h-7 w-7 text-emerald-600" /> My Products &amp; Inventory ({counts.all})
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Unified catalog selection, custom product submissions, approval tracking, pricing &amp; live stock management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCatalogMode('request');
              setSubTab('add');
            }}
            className="h-9 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Submit New Product
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setCatalogMode('catalogue');
              setSubTab('add');
            }}
            className="h-9 font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Products from Catalogue
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 6 Consolidated Navigation Tabs */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTabKey)}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-muted/60 w-full justify-start">
          <TabsTrigger value="all" className="text-xs font-bold gap-1.5">
            <Layers className="h-3.5 w-3.5" /> All Products ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="add" className="text-xs font-bold gap-1.5">
            <Plus className="h-3.5 w-3.5 text-emerald-600" /> Add Product
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs font-bold gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600" /> Pending Approval ({counts.pending})
          </TabsTrigger>
          <TabsTrigger value="approved" className="text-xs font-bold gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approved ({counts.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs font-bold gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Rejected ({counts.rejected})
          </TabsTrigger>
          <TabsTrigger value="low_stock" className="text-xs font-bold gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-amber-600" /> Out / Low Stock ({counts.lowOrOut})
          </TabsTrigger>
        </TabsList>

        {/* TAB: ADD PRODUCT (Catalogue + Request New Product) */}
        <TabsContent value="add" className="mt-4">
          <DealerCatalogClient
            dealer={dealer}
            initialMode={catalogMode}
            onInventoryChanged={async () => {
              await onRefreshProducts();
            }}
          />
        </TabsContent>

        {/* SHARED LIST VIEW FOR ALL OTHER 5 TABS */}
        {subTab !== 'add' && (
          <div className="mt-4 space-y-4">
            {/* Configurable Low Stock Alert Bar & Bulk Stock Bar */}
            {(subTab === 'low_stock' || bulkMode || subTab === 'all') && (
              <Card className="p-3.5 border-border/80 bg-muted/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <BellRing className="h-3.5 w-3.5 text-amber-600" /> Low-Stock Alert Threshold:
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(Math.max(1, Number(e.target.value) || 1))}
                    className="h-8 w-20 text-xs font-mono font-bold"
                  />
                  <span className="text-muted-foreground text-[11px]">units or fewer</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingThreshold}
                    onClick={handleSaveThreshold}
                    className="h-8 text-xs font-semibold"
                  >
                    {savingThreshold ? 'Saving...' : 'Save Alert Rule'}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {bulkMode ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingBulk}
                        onClick={handleSaveBulkStock}
                        className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Save className="h-3.5 w-3.5 mr-1" /> {savingBulk ? 'Applying...' : 'Save Bulk Stock'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBulkMode(false);
                          setBulkEdits({});
                        }}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const initMap: Record<string, string> = {};
                        filtered.forEach((p) => {
                          initMap[p.id] = String(p.stock_qty ?? 0);
                        });
                        setBulkEdits(initMap);
                        setBulkMode(true);
                      }}
                      className="h-8 text-xs font-semibold"
                    >
                      Bulk Stock Update
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Filters & Search */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-44 h-9 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStock} onValueChange={setFilterStock}>
                  <SelectTrigger className="w-36 h-9 text-xs">
                    <SelectValue placeholder="All Stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Stock</SelectItem>
                    <SelectItem value="in_stock" className="text-xs">In Stock</SelectItem>
                    <SelectItem value="limited" className="text-xs">Low Stock (≤{lowStockThreshold})</SelectItem>
                    <SelectItem value="out_of_stock" className="text-xs">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by product name, brand, category, model..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            {/* Mobile Cards (< 768px) */}
            <div className="md:hidden space-y-2.5">
              {filtered.length === 0 ? (
                <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
                  <Package className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
                  No products in this view. Tap &quot;Add Products from Catalogue&quot; or &quot;Submit New Product&quot;.
                </Card>
              ) : (
                filtered.map((p) => {
                  const effective = getEffectivePrice(p.price, p.discount_price);
                  const mod = p.moderation_status || (p.is_active ? 'approved' : 'pending');
                  const qty = p.stock_qty ?? 0;
                  const itemThresh = p.low_stock_threshold ?? lowStockThreshold;
                  const derivedStatus =
                    qty <= 0 || p.stock_status === 'out_of_stock'
                      ? 'Out of Stock'
                      : qty <= itemThresh || p.stock_status === 'limited'
                        ? 'Low Stock'
                        : 'In Stock';

                  return (
                    <Card key={p.id} className="p-3.5 border-border/80 rounded-2xl space-y-2.5 shadow-xs">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.brand?.name || p.brand_name || 'Brand'} • {p.category?.name || 'Category'}
                          </p>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {formatINR(effective)} • <span className="font-mono text-foreground">{qty} units</span>
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span>Views: {p.view_count ?? 0}</span>
                            <span>Enquiries: {p.enquiry_count ?? 0}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant={
                              derivedStatus === 'In Stock'
                                ? 'default'
                                : derivedStatus === 'Low Stock'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="text-[10px]"
                          >
                            {derivedStatus}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              mod === 'approved'
                                ? 'text-[10px] text-emerald-600 border-emerald-500/40'
                                : mod === 'rejected' || mod === 'flagged'
                                  ? 'text-[10px] text-rose-600 border-rose-500/40'
                                  : 'text-[10px] text-amber-600 border-amber-500/40'
                            }
                          >
                            {mod === 'flagged' ? 'Info Requested' : mod}
                          </Badge>
                        </div>
                      </div>

                      {(mod === 'rejected' || mod === 'flagged') && (
                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-2 text-[11px] text-rose-700 dark:text-rose-300">
                          <strong>Admin Note:</strong>{' '}
                          {p.admin_info_request ||
                            p.rejection_reason ||
                            p.specifications?.['Rejection Reason'] ||
                            'Requires updates before approval.'}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(p, mod === 'rejected' || mod === 'flagged')}
                            className="h-8 px-3 text-xs font-semibold rounded-xl"
                          >
                            {mod === 'rejected' || mod === 'flagged' ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Edit &amp; Resubmit
                              </>
                            ) : (
                              <>
                                <Edit className="h-3.5 w-3.5 mr-1" /> Edit Price &amp; Stock
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingHistory(p)}
                            className="h-8 px-2"
                            title="Price History"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveFromShop(p.id, p.name)}
                          className="h-8 px-2.5 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Desktop Table (>= 768px) */}
            <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Product Item</th>
                      <th className="px-4 py-3">Brand &amp; Category</th>
                      <th className="px-4 py-3">Approval Status</th>
                      <th className="px-4 py-3">Selling Price</th>
                      <th className="px-4 py-3">Stock &amp; Status</th>
                      <th className="px-4 py-3">Engagement</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                          <Package className="mx-auto h-8 w-8 opacity-40 mb-2" />
                          No products match this view or filter.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => {
                        const effective = getEffectivePrice(p.price, p.discount_price);
                        const discountPct = getDiscountPercent(p.price, p.discount_price);
                        const mod = p.moderation_status || (p.is_active ? 'approved' : 'pending');
                        const qty = p.stock_qty ?? 0;
                        const itemThresh = p.low_stock_threshold ?? lowStockThreshold;
                        const derivedStatus =
                          qty <= 0 || p.stock_status === 'out_of_stock'
                            ? 'Out of Stock'
                            : qty <= itemThresh || p.stock_status === 'limited'
                              ? 'Low Stock'
                              : 'In Stock';

                        return (
                          <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/50">
                                  {p.images && p.images[0] ? (
                                    <Image
                                      src={p.images[0]}
                                      alt={p.name}
                                      fill
                                      sizes="44px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                      <Package className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <span className="font-bold text-foreground text-xs sm:text-sm block">
                                    {p.name}
                                  </span>
                                  {p.model && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      Model: {p.model}
                                    </span>
                                  )}
                                  {p.master_product_id && (
                                    <Badge variant="outline" className="text-[9px] ml-1.5 py-0 h-4">
                                      Catalogue Item
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-foreground">
                                {p.brand?.name || p.brand_name || 'General Brand'}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {p.category?.name || 'Uncategorized'}
                              </div>
                            </td>

                            <td className="px-4 py-3.5">
                              {mod === 'pending' && (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1 font-semibold">
                                  <Clock className="h-3 w-3" /> Pending Approval
                                </Badge>
                              )}
                              {mod === 'approved' && (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold">
                                  <CheckCircle2 className="h-3 w-3" /> Approved &amp; Live
                                </Badge>
                              )}
                              {(mod === 'rejected' || mod === 'flagged') && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] gap-1 font-semibold">
                                      <AlertTriangle className="h-3 w-3" />{' '}
                                      {mod === 'flagged' ? 'Info Requested' : 'Rejected'}
                                    </Badge>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-rose-600 hover:text-rose-700"
                                      onClick={() => setViewingRejection(p)}
                                      title="View Admin reason"
                                    >
                                      <HelpCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  <p className="text-[10px] text-rose-600 dark:text-rose-300 line-clamp-1 max-w-[200px]">
                                    {p.admin_info_request ||
                                      p.rejection_reason ||
                                      p.specifications?.['Rejection Reason'] ||
                                      'Review note available'}
                                  </p>
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                                {formatINR(effective)}
                              </div>
                              {p.discount_price && (
                                <div className="text-[10px] text-muted-foreground line-through">
                                  {formatINR(p.price)} ({discountPct}% OFF)
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              {bulkMode ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={bulkEdits[p.id] ?? String(qty)}
                                  onChange={(e) =>
                                    setBulkEdits((prev) => ({ ...prev, [p.id]: e.target.value }))
                                  }
                                  className="h-8 w-20 text-xs font-mono font-bold"
                                />
                              ) : (
                                <div className="space-y-1">
                                  <div>
                                    <span className="font-mono font-bold text-xs">{qty}</span>{' '}
                                    <span className="text-[10px] text-muted-foreground">units</span>
                                  </div>
                                  <Badge
                                    variant={
                                      derivedStatus === 'In Stock'
                                        ? 'default'
                                        : derivedStatus === 'Low Stock'
                                          ? 'secondary'
                                          : 'destructive'
                                    }
                                    className="text-[10px] font-semibold"
                                  >
                                    {derivedStatus}
                                  </Badge>
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 text-primary" /> {p.view_count ?? 0} views
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquareText className="h-3 w-3 text-emerald-600" />{' '}
                                  {p.enquiry_count ?? 0} enquiries
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewingHistory(p)}
                                className="h-8 px-2 text-[11px]"
                                title="View price history"
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>

                              {(mod === 'rejected' || mod === 'flagged') ? (
                                <Button
                                  size="sm"
                                  onClick={() => openEditModal(p, true)}
                                  className="h-8 px-2.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Edit &amp; Resubmit
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditModal(p, false)}
                                  className="h-8 px-2 text-[11px] font-semibold"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit / Stock
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveFromShop(p.id, p.name)}
                                className="h-8 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                                title="Remove from shop"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </Tabs>

      {/* Edit / Resubmit Product Dialog */}
      <Dialog
        open={!!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
            setIsResubmitting(false);
          }
        }}
      >
        {editingProduct && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Edit className="h-5 w-5 text-emerald-600" />
                {isResubmitting ? 'Edit & Resubmit Product for Approval' : 'Edit Product, Price & Stock'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingProduct.master_product_id
                  ? 'Linked Catalogue Item: customize your showroom pricing, live stock count, warranty, and delivery options.'
                  : 'Customize product details, pricing, stock counts, and images for your showroom.'}
              </DialogDescription>
            </DialogHeader>

            {(editingProduct.rejection_reason || editingProduct.admin_info_request) && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                <p className="font-bold">Admin Review Feedback:</p>
                <p className="mt-0.5">
                  {editingProduct.admin_info_request || editingProduct.rejection_reason}
                </p>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 py-2 text-xs">
              <div>
                <Label className="text-xs font-bold text-foreground">Product Title / Name *</Label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  disabled={Boolean(editingProduct.master_product_id)}
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-foreground">Category</Label>
                  <Select
                    value={categoryInput}
                    onValueChange={setCategoryInput}
                    disabled={Boolean(editingProduct.master_product_id)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Category" />
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
                  <Label className="text-xs font-bold text-foreground">Brand</Label>
                  <Select
                    value={brandInput}
                    onValueChange={setBrandInput}
                    disabled={Boolean(editingProduct.master_product_id)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">Model Number / SKU</Label>
                  <Input
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    disabled={Boolean(editingProduct.master_product_id)}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">MRP / Original Price (₹) *</Label>
                  <Input
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="mt-1 h-9 text-xs font-bold"
                    min={1}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Showroom Selling Price (₹)
                  </Label>
                  <Input
                    type="number"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="Special offer price"
                    className="mt-1 h-9 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold text-foreground">Stock Units *</Label>
                  <Input
                    type="number"
                    value={stockQtyInput}
                    onChange={(e) => setStockQtyInput(e.target.value)}
                    className="mt-1 h-9 text-xs font-bold font-mono"
                    min={0}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground">Low-Stock Alert At</Label>
                  <Input
                    type="number"
                    value={lowThresholdInput}
                    onChange={(e) => setLowThresholdInput(e.target.value)}
                    className="mt-1 h-9 text-xs font-mono"
                    min={1}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground">Availability Status</Label>
                  <Select
                    value={stockStatusInput}
                    onValueChange={(val) => setStockStatusInput(val as Product['stock_status'])}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock" className="text-xs">In Stock</SelectItem>
                      <SelectItem value="limited" className="text-xs">Low Stock</SelectItem>
                      <SelectItem value="out_of_stock" className="text-xs">Out of Stock</SelectItem>
                      <SelectItem value="restocking" className="text-xs">Restocking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!editingProduct.master_product_id && (
                <div className="p-3 rounded-xl border border-border bg-card">
                  <ImagePicker
                    value={imageInput}
                    onChange={setImageInput}
                    label="Product Photo"
                    description="Pick from gallery or paste web link"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-foreground">Warranty Details</Label>
                  <Input
                    value={warrantyInput}
                    onChange={(e) => setWarrantyInput(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground">Color / Variant</Label>
                  <Input
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              {!editingProduct.master_product_id && (
                <div>
                  <Label className="text-xs font-bold text-foreground">Description</Label>
                  <Textarea
                    rows={3}
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 p-3 rounded-xl border border-border bg-muted/20">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={deliveryInput}
                    onChange={(e) => setDeliveryInput(e.target.checked)}
                    className="rounded border-border text-emerald-600 h-4 w-4"
                  />
                  <span>Home Delivery Available</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={pickupInput}
                    onChange={(e) => setPickupInput(e.target.checked)}
                    className="rounded border-border text-emerald-600 h-4 w-4"
                  />
                  <span>Store Pickup Available</span>
                </label>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsResubmitting(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving...
                    </>
                  ) : isResubmitting ? (
                    'Update & Resubmit for Approval'
                  ) : (
                    'Save All Changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Rejection / Info Feedback Dialog */}
      <Dialog open={!!viewingRejection} onOpenChange={(open) => !open && setViewingRejection(null)}>
        {viewingRejection && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Admin Moderation Feedback
              </DialogTitle>
              <DialogDescription>
                Review decision details for &quot;{viewingRejection.name}&quot;
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground">
                <span className="font-bold block mb-1 text-destructive">
                  {viewingRejection.admin_info_request ? 'Additional Information Requested:' : 'Rejection Reason:'}
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {viewingRejection.admin_info_request ||
                    viewingRejection.rejection_reason ||
                    viewingRejection.specifications?.['Rejection Reason'] ||
                    'Please review specs, pricing, and product images, then resubmit.'}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setViewingRejection(null)}>
                Close
              </Button>
              <Button
                type="button"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={() => {
                  const target = viewingRejection;
                  setViewingRejection(null);
                  openEditModal(target, true);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Edit &amp; Resubmit
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Price History Dialog */}
      <Dialog open={!!viewingHistory} onOpenChange={(open) => !open && setViewingHistory(null)}>
        {viewingHistory && (
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-black">
                <History className="h-4 w-4 text-primary" /> Price History
              </DialogTitle>
              <DialogDescription className="text-xs">{viewingHistory.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2 text-xs">
              {!viewingHistory.price_history || viewingHistory.price_history.length === 0 ? (
                <div className="p-4 rounded-xl border border-border bg-muted/20 text-center text-muted-foreground">
                  Current Price: <strong>{formatINR(viewingHistory.price)}</strong>
                  {viewingHistory.discount_price ? ` (Offer: ${formatINR(viewingHistory.discount_price)})` : ''}
                  <p className="mt-1 text-[11px]">No price revisions recorded since initial listing.</p>
                </div>
              ) : (
                viewingHistory.price_history.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border bg-card"
                  >
                    <div>
                      <p className="font-bold text-foreground">
                        {formatINR(entry.new_discount ?? entry.new_price)}
                        {entry.old_price !== entry.new_price && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground line-through">
                            from {formatINR(entry.old_discount ?? entry.old_price)}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        MRP: {formatINR(entry.new_price)} • Updated by {entry.changed_by || 'Dealer'}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(entry.changed_at)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setViewingHistory(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
