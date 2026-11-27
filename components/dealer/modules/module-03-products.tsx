'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,DialogContent,DialogDescription,
  DialogFooter,
  DialogHeader,DialogTitle,
} from '@/components/ui/dialog';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,SelectContent,SelectItem,SelectTrigger,SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { broadcastSync,getDbCategories,saveDbProduct } from '@/lib/firebase-db';
import { formatINR,getDiscountPercent,getEffectivePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Category,Dealer,Product } from '@/lib/types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit,
  HelpCircle,
  Package,
  Plus,
  Search,
  Trash2
} from 'lucide-react';
import Image from 'next/image';
import { useEffect,useMemo,useState } from 'react';
import { toast } from 'sonner';

type Module03Props = {
  dealer: Dealer;
  products: Product[];
  onRefreshProducts: () => Promise<void>;
  onNavigateTab: (tabId: string) => void;
};

export function Module03DealerProducts({
  dealer,
  products,
  onRefreshProducts,
  onNavigateTab,
}: Module03Props) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterModeration, setFilterModeration] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingRejection, setViewingRejection] = useState<Product | null>(null);

  // All-in-one edit form fields
  const [nameInput, setNameInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [stockQtyInput, setStockQtyInput] = useState('');
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
    getDbCategories().then(setCategories).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filterStatus !== 'all' && p.stock_status !== filterStatus) return false;
      if (filterModeration !== 'all') {
        const mod = p.moderation_status || (p.is_master || p.is_active ? 'approved' : 'pending');
        if (mod !== filterModeration) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchBrand = p.brand?.name?.toLowerCase().includes(q);
        const matchCat = p.category?.name?.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchCat) return false;
      }
      return true;
    });
  }, [products, filterStatus, filterModeration, search]);

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setNameInput(p.name || '');
    setModelInput(p.model || '');
    setCategoryInput(p.category_id || (p.category?.id ?? ''));
    setPriceInput(String(p.price || 0));
    setDiscountInput(p.discount_price ? String(p.discount_price) : '');
    setStockQtyInput(String(p.stock_qty || 0));
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
    setSaving(true);
    try {
      const updatedPrice = parseFloat(priceInput) || editingProduct.price;
      const updatedDiscount = discountInput ? parseFloat(discountInput) : null;
      const updatedStockQty = parseInt(stockQtyInput, 10) || 0;

      const updated: Product = {
        ...editingProduct,
        name: nameInput.trim() || editingProduct.name,
        model: modelInput.trim() || null,
        category_id: categoryInput || editingProduct.category_id,
        price: updatedPrice,
        discount_price: updatedDiscount,
        stock_qty: updatedStockQty,
        stock_status: stockStatusInput,
        images: imageInput ? [imageInput] : editingProduct.images,
        description: descriptionInput.trim() || editingProduct.description,
        warranty: warrantyInput.trim() || null,
        color: colorInput.trim() || null,
        delivery_available: deliveryInput,
        pickup_available: pickupInput,
        specifications: {
          ...(editingProduct.specifications || {}),
          'Warranty': warrantyInput.trim() || 'Standard Warranty',
          'Color': colorInput.trim() || 'Standard',
        },
        updated_at: new Date().toISOString(),
      };

      await saveDbProduct(updated);
      broadcastSync('products', updated);

      setFeedback({ type: 'success', text: `"${updated.name}" updated across your shop & storefront!` });
      toast.success(`"${updated.name}" updated successfully across your entire shop!`);
      setEditingProduct(null);
      await onRefreshProducts();
    } catch {
      setFeedback({ type: 'error', text: 'Failed to update product details' });
      toast.error('Failed to update product details');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromShop = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from your shop inventory?`)) return;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('dealer_id', dealer.id);
      if (error) throw error;
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
    } catch {
      setFeedback({ type: 'error', text: 'Failed to remove product' });
      toast.error('Failed to remove product');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Package className="h-7 w-7 text-emerald-600" /> My Shop Products ({products.length})
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Manage your shop&apos;s active listings, custom showroom prices, discounts & live stock counts
          </p>
        </div>

        <Button
          onClick={() => onNavigateTab('04-add-products')}
          className="font-bold gap-1.5 self-start sm:self-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Master Catalog Products
        </Button>
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
          <button type="button" onClick={() => setFeedback(null)} className="text-[11px] opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Stock ({products.length})
              </SelectItem>
              <SelectItem value="in_stock" className="text-xs">
                In Stock
              </SelectItem>
              <SelectItem value="limited" className="text-xs">
                Limited Stock
              </SelectItem>
              <SelectItem value="out_of_stock" className="text-xs">
                Out of Stock
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterModeration} onValueChange={setFilterModeration}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Approval Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Approvals
              </SelectItem>
              <SelectItem value="approved" className="text-xs">
                Approved & Active
              </SelectItem>
              <SelectItem value="pending" className="text-xs">
                Pending Admin Review
              </SelectItem>
              <SelectItem value="rejected" className="text-xs">
                Rejected
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by product name, brand, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Mobile Products Cards (< 768px) */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
            <Package className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
            No products found. Tap &quot;Add Master Catalog Products&quot; to begin.
          </Card>
        ) : (
          filtered.map((p) => {
            const effective = getEffectivePrice(p.price, p.discount_price);
            return (
              <Card key={p.id} className="p-3.5 border-border/80 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.brand?.name || 'Brand'} • {p.category?.name || 'Category'}</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatINR(effective)} • <span className="font-mono text-foreground">{p.stock_qty ?? 0} units</span>
                    </p>
                  </div>
                  <Badge variant={p.stock_status === 'in_stock' ? 'default' : p.stock_status === 'limited' ? 'secondary' : 'destructive'} className="text-[10px] capitalize shrink-0">
                    {p.stock_status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => openEditModal(p)} className="h-8 px-3 text-xs font-semibold rounded-xl">
                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit Price & Stock
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveFromShop(p.id, p.name)} className="h-8 px-2.5 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Products Table Card (>= 768px) */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Product Item</th>
                <th className="px-4 py-3">Brand & Category</th>
                <th className="px-4 py-3">Approval Status</th>
                <th className="px-4 py-3">Showroom Price</th>
                <th className="px-4 py-3">Stock Units</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    No products found. Tap &quot;Add or Create Products&quot; to pick or propose products.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const effective = getEffectivePrice(p.price, p.discount_price);
                  const discountPct = getDiscountPercent(p.price, p.discount_price);
                  const moderation = p.moderation_status || (p.is_master || p.is_active ? 'approved' : 'pending');

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
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">
                          {p.brand?.name || 'General Brand'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.category?.name || 'Uncategorized'}
                        </div>
                      </td>

                      {/* Approval Status Badge */}
                      <td className="px-4 py-3.5">
                        {moderation === 'pending' && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1 font-semibold">
                            <Clock className="h-3 w-3" /> Pending Review
                          </Badge>
                        )}
                        {moderation === 'approved' && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Approved & Live
                          </Badge>
                        )}
                        {moderation === 'rejected' && (
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] gap-1 font-semibold">
                              <AlertTriangle className="h-3 w-3" /> Rejected
                            </Badge>
                            {p.specifications?.['Rejection Reason'] && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-rose-600 hover:text-rose-700"
                                onClick={() => setViewingRejection(p)}
                                title="View reason"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
                        <span className="font-mono font-bold text-xs">{p.stock_qty ?? 0}</span>{' '}
                        <span className="text-[10px] text-muted-foreground">units</span>
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

                      <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(p)}
                          className="h-8 px-2 text-[11px] font-semibold"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit Price & Stock
                        </Button>
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

      {/* All-in-One Comprehensive Product Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        {editingProduct && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Edit className="h-5 w-5 text-emerald-600" /> Edit Product Details & Showroom Options
              </DialogTitle>
              <DialogDescription className="text-xs">
                You can freely customize title, pricing, gallery photos, stock counts, and warranty for your store.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveProduct} className="space-y-4 py-2 text-xs">
              {/* Product Title */}
              <div>
                <Label className="text-xs font-bold text-foreground">Product Title / Name *</Label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Product display name"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category Selection */}
                <div>
                  <Label className="text-xs font-bold text-foreground">Category</Label>
                  <Select value={categoryInput} onValueChange={setCategoryInput}>
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

                {/* Model Number */}
                <div>
                  <Label className="text-xs font-bold text-foreground">Model Number / SKU</Label>
                  <Input
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    placeholder="e.g. S24-256GB"
                    className="mt-1 h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-foreground">MRP / Original Price (₹) *</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="pl-6 h-9 text-xs font-bold"
                      min={0}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Showroom Selling Price (₹)
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">₹</span>
                    <Input
                      type="number"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="Special offer price"
                      className="pl-6 h-9 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Stock and Availability Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-foreground">Stock Units Available *</Label>
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
                  <Label className="text-xs font-bold text-foreground">Availability Status</Label>
                  <Select
                    value={stockStatusInput}
                    onValueChange={(val: any) => setStockStatusInput(val)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock" className="text-xs">
                        In Stock (Available)
                      </SelectItem>
                      <SelectItem value="limited" className="text-xs">
                        Limited Stock (≤5)
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
              </div>

              {/* Image Picker with Gallery Upload & URL */}
              <div className="p-3 rounded-xl border border-border bg-card">
                <ImagePicker
                  value={imageInput}
                  onChange={setImageInput}
                  label="Product Photo"
                  description="Pick from device gallery / camera or paste a web link"
                />
              </div>

              {/* Warranty and Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-foreground">Warranty Details</Label>
                  <Input
                    value={warrantyInput}
                    onChange={(e) => setWarrantyInput(e.target.value)}
                    placeholder="e.g. 1 Year Brand Warranty"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground">Color / Variant</Label>
                  <Input
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    placeholder="e.g. Midnight Black, Silver"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs font-bold text-foreground">Description & Key Specifications</Label>
                <Textarea
                  rows={3}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Describe key features, accessories, box contents..."
                  className="mt-1 text-xs"
                />
              </div>

              {/* Delivery & Pickup Toggles */}
              <div className="flex flex-col sm:flex-row gap-4 p-3 rounded-xl border border-border bg-muted/20">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={deliveryInput}
                    onChange={(e) => setDeliveryInput(e.target.checked)}
                    className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Home Delivery Available</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={pickupInput}
                    onChange={(e) => setPickupInput(e.target.checked)}
                    className="rounded border-border text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Store Pickup Available</span>
                </label>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? 'Updating Product...' : 'Save All Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Rejection Details Dialog */}
      <Dialog open={!!viewingRejection} onOpenChange={(open) => !open && setViewingRejection(null)}>
        {viewingRejection && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Admin Moderation Feedback
              </DialogTitle>
              <DialogDescription>
                Details regarding the review decision for &quot;{viewingRejection.name}&quot;
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground">
                <span className="font-bold block mb-1 text-destructive">Reason for Rejection:</span>
                <p className="text-muted-foreground leading-relaxed">
                  {viewingRejection.specifications?.['Rejection Reason'] ||
                    'Product details, images, or pricing did not meet the marketplace quality standards. Please edit and resubmit.'}
                </p>
              </div>

              <p className="text-muted-foreground text-[11px]">
                You can remove this listing and add an approved item from the Master Catalog under &quot;Add Master Products&quot;.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setViewingRejection(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
