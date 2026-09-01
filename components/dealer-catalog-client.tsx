'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  Package, Search, Plus, Check, X, Edit, Trash2, Power, Loader2,
  ShoppingCart, Store, Tag, Save, PackageCheck, AlertCircle,
  Zap, Sparkles, Upload, MapPin, Camera, CheckCircle2, ChevronRight,
  ChevronDown, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase, type Product, type Category, type Brand, type DealerInventory, type Dealer } from '@/lib/supabase';
import {
  fetchMasterCatalog, fetchCategories, fetchBrands,
  addProductToInventory, updateDealerInventory, removeDealerInventory,
  toggleInventoryActive, fetchDealerInventory, fetchDealerInventoryProductIds,
  quickAddToInventory, bulkQuickAddToInventory, aiSearchCatalog,
  type DealerInventoryInput,
} from '@/lib/catalog';

export function DealerCatalogClient({ dealer }: { dealer: Dealer }) {
  const [tab, setTab] = useState('browse');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [inventory, setInventory] = useState<DealerInventory[]>([]);
  const [inventoryProductIds, setInventoryProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<DealerInventory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DealerInventory | null>(null);
  const [quickAddTarget, setQuickAddTarget] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, inv, cats, brnds] = await Promise.all([
        fetchMasterCatalog(),
        fetchDealerInventory(dealer.id),
        fetchCategories(),
        fetchBrands(),
      ]);
      setCatalog(cat);
      setInventory(inv);
      setInventoryProductIds(await fetchDealerInventoryProductIds(dealer.id));
      setCategories(cats);
      setBrands(brnds);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load catalog');
    } finally { setLoading(false); }
  }, [dealer.id]);

  useEffect(() => { load(); }, [load]);

  const rootCategories = categories.filter((c) => !c.parent_id);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${p.name} ${p.brand?.name ?? ''} ${p.category?.name ?? ''} ${p.tags.join(' ')} ${(p as any).keywords?.join(' ') ?? ''} ${(p as any).model_number ?? ''} ${p.model ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;
      return true;
    });
  }, [catalog, search, filterCategory]);

  // Group products by category for the tick-list view
  const groupedCatalog = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const p of filteredCatalog) {
      const catName = p.category?.name ?? 'Uncategorized';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    }
    return groups;
  }, [filteredCatalog]);

  const handleQuickAdd = async (product: Product) => {
    setSaving(true);
    try {
      const { error } = await quickAddToInventory(dealer.id, product.id);
      if (error) { toast.error(error); return; }
      toast.success(`${product.name} added to your store`);
      setInventoryProductIds((prev) => new Set(prev).add(product.id));
      setQuickAddTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add product');
    } finally { setSaving(false); }
  };

  const handleRemove = async () => {
    if (!deleteTarget) return;
    const { error } = await removeDealerInventory(deleteTarget.id, dealer.id);
    if (error) { toast.error(error); return; }
    toast.success('Product removed from your store');
    setDeleteTarget(null);
    load();
  };

  const handleToggleInv = async (inv: DealerInventory) => {
    const { error } = await toggleInventoryActive(inv.id, !inv.is_active);
    if (error) { toast.error(error); return; }
    toast.success(`Listing ${inv.is_active ? 'disabled' : 'enabled'}`);
    setInventory((prev) => prev.map((i) => i.id === inv.id ? { ...i, is_active: !i.is_active } : i));
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="browse" className="flex-1"><ShoppingCart className="mr-1.5 h-4 w-4" /> Add Products</TabsTrigger>
          <TabsTrigger value="inventory" className="flex-1"><Store className="mr-1.5 h-4 w-4" /> My Store ({inventory.length})</TabsTrigger>
        </TabsList>

        {/* Browse catalog — tick list / quick add */}
        <TabsContent value="browse" className="mt-4 space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-primary">Add Products to My Store</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Search and select products you have in your shop. Just click "Add" — no forms needed. You can add price and details later.</p>
          </div>

          {/* AI-powered search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, brand, model... (e.g. S25 ultra, Samsung latest phone)"
              className="pl-9"
            />
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filterCategory === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 hover:bg-muted/50'
              )}
            >
              All
            </button>
            {rootCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterCategory(c.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  filterCategory === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 hover:bg-muted/50'
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Product list grouped by category */}
          {filteredCatalog.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No Products Found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try a different search term. The admin needs to create products first.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedCatalog).map(([catName, products]) => (
                <div key={catName}>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" /> {catName}
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map((product) => {
                      const inInventory = inventoryProductIds.has(product.id);
                      return (
                        <div
                          key={product.id}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-3 transition-all',
                            inInventory ? 'border-success/30 bg-success/5' : 'border-border/60 hover:border-primary/40 hover:bg-muted/30',
                          )}
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                            {product.images[0] ? (
                              <Image src={product.images[0]} alt={product.name} fill sizes="48px" className="object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.brand?.name ?? 'No brand'}</p>
                          </div>
                          {inInventory ? (
                            <Badge className="shrink-0 bg-success/15 text-success">
                              <Check className="mr-0.5 h-3 w-3" /> In Store
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              className="shrink-0"
                              onClick={() => setQuickAddTarget(product)}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" /> Add
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Store inventory */}
        <TabsContent value="inventory" className="mt-4 space-y-4">
          <div className="rounded-lg border border-success/30 bg-success/5 p-4">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-success" />
              <h3 className="font-semibold text-success">My Store Inventory ({inventory.length})</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Products in your shop. Click edit to update price, stock, or add a store photo.</p>
          </div>

          {inventory.length === 0 ? (
            <Card className="p-12 text-center">
              <PackageCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No Products in Your Store Yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Browse the catalog and add products you stock. Just one click per product.</p>
              <Button className="mt-4" onClick={() => setTab('browse')}><ShoppingCart className="mr-1.5 h-4 w-4" /> Add Products</Button>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Stock</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">Condition</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">Delivery</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {inventory.map((inv) => (
                    <tr key={inv.id} className={cn('hover:bg-muted/20', !inv.is_active && 'opacity-50')}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            {(inv.images[0] || inv.product?.images[0]) && <Image src={inv.images[0] || inv.product!.images[0]} alt={inv.product?.name ?? ''} fill sizes="40px" className="object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-medium">{inv.product?.name}</p>
                            <p className="text-xs text-muted-foreground">{inv.product?.brand?.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {inv.price > 0 ? (
                          <span className="font-medium">{formatINR(inv.price)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                        {inv.offer_price && <p className="text-xs text-success">Offer: {formatINR(inv.offer_price)}</p>}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        {inv.stock_qty > 0 ? (
                          <Badge className={cn(inv.stock_status === 'in_stock' ? 'bg-success/15 text-success' : inv.stock_status === 'limited' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive')}>
                            {inv.stock_qty} {inv.stock_status === 'in_stock' ? 'in stock' : inv.stock_status === 'limited' ? 'limited' : 'out'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 capitalize md:table-cell">{inv.condition}</td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        <div className="flex gap-1">
                          {inv.delivery_available && <Badge variant="outline" className="text-[10px]">Delivery</Badge>}
                          {inv.pickup_available && <Badge variant="outline" className="text-[10px]">Pickup</Badge>}
                          {!inv.delivery_available && !inv.pickup_available && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={cn(inv.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                          {inv.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit details" onClick={() => setEditTarget(inv)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Enable/Disable" onClick={() => handleToggleInv(inv)}><Power className={cn('h-3.5 w-3.5', inv.is_active ? 'text-success' : 'text-muted-foreground')} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Remove" onClick={() => setDeleteTarget(inv)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Add confirmation */}
      {quickAddTarget && (
        <Dialog open={!!quickAddTarget} onOpenChange={(v) => !v && setQuickAddTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> Add to My Store
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="relative h-16 w-16 overflow-hidden rounded bg-muted">
                {quickAddTarget.images[0] && <Image src={quickAddTarget.images[0]} alt={quickAddTarget.name} fill sizes="64px" className="object-cover" />}
              </div>
              <div>
                <p className="font-semibold">{quickAddTarget.name}</p>
                <p className="text-xs text-muted-foreground">{quickAddTarget.brand?.name} · {quickAddTarget.category?.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Is this product available in your store? Click "Yes, Add" to add it instantly. You can set price and details later.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickAddTarget(null)}>Cancel</Button>
              <Button className="bg-success hover:bg-success/90" onClick={() => handleQuickAdd(quickAddTarget)} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                Yes, Add to My Store
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit inventory dialog */}
      {editTarget && (
        <InventoryEditDialog
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          product={editTarget.product!}
          dealerId={dealer.id}
          existing={editTarget}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.product?.name}" from your store? You can re-add it later from the catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Inventory Edit Dialog — simple optional fields
// ============================================================

function InventoryEditDialog({
  open, onOpenChange, product, dealerId, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product;
  dealerId: string;
  existing?: DealerInventory;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(existing?.price ? String(existing.price) : '');
  const [offerPrice, setOfferPrice] = useState(existing?.offer_price ? String(existing.offer_price) : '');
  const [stockQty, setStockQty] = useState(existing?.stock_qty ? String(existing.stock_qty) : '');
  const [condition, setCondition] = useState<'new' | 'used' | 'refurbished' | 'open_box'>(existing?.condition ?? 'new');
  const [deliveryAvailable, setDeliveryAvailable] = useState(existing?.delivery_available ?? false);
  const [pickupAvailable, setPickupAvailable] = useState(existing?.pickup_available ?? true);
  const [images, setImages] = useState((existing?.images ?? []).join('\n'));

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: DealerInventoryInput = {
        product_id: product.id,
        price: price ? parseFloat(price) : 0,
        discount_price: null,
        stock_qty: stockQty ? parseInt(stockQty) : 0,
        stock_status: stockQty ? 'in_stock' : 'in_stock',
        condition,
        images: images.split('\n').map((s: string) => s.trim()).filter(Boolean),
      };

      if (existing) {
        const { error } = await updateDealerInventory(existing.id, input);
        if (error) throw error;

        // Update delivery/pickup and offer_price via direct supabase call
        const { error: extraError } = await supabase
          .from('dealer_inventory')
          .update({
            delivery_available: deliveryAvailable,
            pickup_available: pickupAvailable,
            offer_price: offerPrice ? parseFloat(offerPrice) : null,
          })
          .eq('id', existing.id);
        if (extraError) console.warn('Extra field update:', extraError.message);

        toast.success('Inventory updated');
      } else {
        const { error } = await addProductToInventory(dealerId, input);
        if (error) throw error;
        toast.success('Product added to your store');
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> Edit Store Details
          </DialogTitle>
        </DialogHeader>

        {/* Product summary — read only */}
        <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
          <div className="relative h-16 w-16 overflow-hidden rounded bg-muted">
            {product.images[0] && <Image src={product.images[0]} alt={product.name} fill sizes="64px" className="object-cover" />}
          </div>
          <div>
            <p className="font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.brand?.name} · {product.category?.name}</p>
            <p className="text-xs text-muted-foreground">{(product as any).short_description ?? product.description?.slice(0, 60)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-muted-foreground">
            All fields below are optional. Just save to mark this product as available in your store.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-sm">Your Price</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Offer Price</Label>
              <Input type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-sm">Quantity</Label>
              <Input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Condition</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as 'new' | 'used' | 'refurbished' | 'open_box')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                  <SelectItem value="open_box">Open Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={deliveryAvailable} onCheckedChange={setDeliveryAvailable} />
              <Label className="text-sm">Delivery Available</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pickupAvailable} onCheckedChange={setPickupAvailable} />
              <Label className="text-sm">Pickup Available</Label>
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-sm">Store Photo (optional, one URL per line)</Label>
            <Textarea value={images} onChange={(e) => setImages(e.target.value)} placeholder="Upload a photo of this product in your shop" className="min-h-[50px] text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
