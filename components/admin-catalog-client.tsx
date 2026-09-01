'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  Package, Plus, Search, Edit, Trash2, Power, Sparkles, X, Check,
  Tag, Building2, ChevronDown, ChevronRight, Image as ImageIcon,
  Settings, Save, AlertCircle, Loader2, BarChart3, Eye, Zap, ListPlus,
  RefreshCw, CheckCircle2, Clock, AlertTriangle, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
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
import { supabase, type Product, type Category, type Brand } from '@/lib/supabase';
import {
  fetchMasterCatalogForAdmin, createCatalogProduct, updateCatalogProduct,
  deleteCatalogProduct, toggleProductActive, analyzeImageForCatalog,
  fetchCategories, fetchBrands, createCategory, createBrand,
  fetchCatalogAnalytics, type CatalogProductInput,
  createProductWithAI, bulkCreateProductsWithAI, regenerateProductAI,
  approveProduct, updateProductImage, checkDuplicateProduct,
} from '@/lib/catalog';
import { aiGenerateProduct, type AiGeneratedProduct } from '@/lib/ai';

export function AdminCatalogClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterAIStatus, setFilterAIStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [reviewingProduct, setReviewingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [analytics, setAnalytics] = useState<{
    totalProducts: number; activeProducts: number; totalListings: number;
    topSelected: { product: Product; listingCount: number }[];
    topSearched: Product[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats, brnds, an] = await Promise.all([
        fetchMasterCatalogForAdmin(),
        fetchCategories(),
        fetchBrands(),
        fetchCatalogAnalytics(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setBrands(brnds);
      setAnalytics(an);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to load catalog');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;
      if (filterBrand !== 'all' && p.brand_id !== filterBrand) return false;
      if (filterAIStatus !== 'all' && (p as any).ai_status !== filterAIStatus) return false;
      return true;
    });
  }, [products, search, filterCategory, filterBrand, filterAIStatus]);

  const handleToggle = async (product: Product) => {
    const { error } = await toggleProductActive(product.id, !product.is_active);
    if (error) { toast.error(error); return; }
    toast.success(`Product ${product.is_active ? 'disabled' : 'enabled'}`);
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
  };

  const handleApprove = async (product: Product) => {
    const { error } = await approveProduct(product.id);
    if (error) { toast.error(error); return; }
    toast.success('Product approved and available to dealers');
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_active: true, ai_status: 'approved', moderation_status: 'approved' } : p));
    setReviewingProduct(null);
  };

  const handleRegenerate = async (product: Product) => {
    toast.info('Regenerating AI information...');
    const { error } = await regenerateProductAI(product.id);
    if (error) { toast.error(error); return; }
    toast.success('AI information regenerated');
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await deleteCatalogProduct(deleteTarget.id);
    if (error) { toast.error(error); return; }
    toast.success('Product deleted');
    setDeleteTarget(null);
    load();
  };

  const rootCategories = categories.filter((c) => !c.parent_id);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox icon={Package} label="Catalog Products" value={analytics.totalProducts} />
          <StatBox icon={Check} label="Active" value={analytics.activeProducts} color="text-success" />
          <StatBox icon={BarChart3} label="Dealer Listings" value={analytics.totalListings} color="text-primary" />
          <StatBox icon={Sparkles} label="AI Generated" value={products.filter((p) => (p as any).ai_status === 'generated' || (p as any).ai_status === 'approved').length} color="text-accent" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-9" />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {rootCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAIStatus} onValueChange={setFilterAIStatus}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="AI Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <ListPlus className="mr-1.5 h-4 w-4" /> Bulk Create
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create Product
          </Button>
        </div>
      </div>

      {/* Product table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No Products Found</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first product by just entering a name. AI will fill in the rest.</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create Product
          </Button>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Brand</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Category</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Listings</th>
                <th className="px-3 py-2 font-medium">AI Status</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((product) => {
                const listingCount = analytics?.topSelected.find((t) => t.product.id === product.id)?.listingCount ?? 0;
                const aiStatus = (product as any).ai_status ?? 'pending';
                return (
                  <tr key={product.id} className={cn('hover:bg-muted/20', !product.is_active && 'opacity-50')}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                          {product.images[0] ? <Image src={product.images[0]} alt={product.name} fill sizes="40px" className="object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium">{product.name}</p>
                          {(product as any).model_number && <p className="text-xs text-muted-foreground">Model: {(product as any).model_number}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell">{product.brand?.name ?? '—'}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">{product.category?.name ?? '—'}</td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      {listingCount > 0 ? <Badge className="bg-primary/15 text-primary">{listingCount}</Badge> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-2">
                      <AIStatusBadge status={aiStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={cn(product.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                        {product.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Review / Edit" onClick={() => setReviewingProduct(product)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Regenerate AI" onClick={() => handleRegenerate(product)}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Enable/Disable" onClick={() => handleToggle(product)}>
                          <Power className={cn('h-3.5 w-3.5', product.is_active ? 'text-success' : 'text-muted-foreground')} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={() => setDeleteTarget(product)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Simple Create Dialog */}
      {showCreate && (
        <SimpleCreateDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          categories={categories}
          brands={brands}
          onSaved={() => { setShowCreate(false); load(); }}
          onCreateCategory={async (name, parentId) => {
            const { category, error } = await createCategory(name, 'Tag', parentId);
            if (error) { toast.error(error); return null; }
            toast.success('Category created');
            const cats = await fetchCategories();
            setCategories(cats);
            return category;
          }}
          onCreateBrand={async (name) => {
            const { brand, error } = await createBrand(name);
            if (error) { toast.error(error); return null; }
            toast.success('Brand created');
            const brnds = await fetchBrands();
            setBrands(brnds);
            return brand;
          }}
        />
      )}

      {/* Bulk Create Dialog */}
      {showBulk && (
        <BulkCreateDialog
          open={showBulk}
          onOpenChange={setShowBulk}
          onSaved={() => { setShowBulk(false); load(); }}
        />
      )}

      {/* Review / Edit Dialog */}
      {reviewingProduct && (
        <ReviewProductDialog
          open={!!reviewingProduct}
          onOpenChange={(v) => !v && setReviewingProduct(null)}
          product={reviewingProduct}
          categories={categories}
          brands={brands}
          subcategories={categories.filter((c) => c.parent_id)}
          onApprove={() => handleApprove(reviewingProduct)}
          onRegenerate={() => handleRegenerate(reviewingProduct)}
          onSaved={() => { setReviewingProduct(null); load(); }}
          onCreateCategory={async (name, parentId) => {
            const { category, error } = await createCategory(name, 'Tag', parentId);
            if (error) { toast.error(error); return null; }
            toast.success('Category created');
            const cats = await fetchCategories();
            setCategories(cats);
            return category;
          }}
          onCreateBrand={async (name) => {
            const { brand, error } = await createBrand(name);
            if (error) { toast.error(error); return null; }
            toast.success('Brand created');
            const brnds = await fetchBrands();
            setBrands(brnds);
            return brand;
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This will also remove all dealer inventory entries for this product. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></div>
      <p className={cn('mt-1 text-xl font-bold', color)}>{value}</p>
    </div>
  );
}

function AIStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string; icon: any }> = {
    pending: { className: 'bg-muted text-muted-foreground', label: 'Pending', icon: Clock },
    generating: { className: 'bg-accent/15 text-accent', label: 'Generating', icon: Loader2 },
    generated: { className: 'bg-accent/15 text-accent', label: 'AI Generated', icon: Sparkles },
    approved: { className: 'bg-success/15 text-success', label: 'Approved', icon: CheckCircle2 },
    failed: { className: 'bg-destructive/15 text-destructive', label: 'Failed', icon: AlertTriangle },
  };
  const c = config[status] ?? config.pending;
  const Icon = c.icon;
  return <Badge className={c.className}><Icon className="mr-0.5 h-3 w-3" /> {c.label}</Badge>;
}

// ============================================================
// Simple Create Dialog — Name + Optional Image only
// ============================================================

function SimpleCreateDialog({
  open, onOpenChange, categories, brands, onSaved, onCreateCategory, onCreateBrand,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  brands: Brand[];
  onSaved: () => void;
  onCreateCategory: (name: string, parentId?: string | null) => Promise<Category | null>;
  onCreateBrand: (name: string) => Promise<Brand | null>;
}) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [duplicates, setDuplicates] = useState<Product[] | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [generated, setGenerated] = useState<AiGeneratedProduct | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleCheckDuplicate = async () => {
    if (!name.trim()) return;
    setCheckingDup(true);
    try {
      const { similar } = await checkDuplicateProduct(name.trim());
      setDuplicates(similar);
    } catch { setDuplicates(null); }
    finally { setCheckingDup(false); }
  };

  const handlePreviewAI = () => {
    if (!name.trim()) return;
    const result = aiGenerateProduct(name.trim());
    setGenerated(result);
    setShowPreview(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Product name is required'); return; }
    setCreating(true);
    try {
      const { product, generated: gen, error } = await createProductWithAI({ name: name.trim(), imageUrl: imageUrl.trim() || null });
      if (error) { toast.error(error); return; }
      toast.success('Product created with AI-generated information. Review and approve it.');
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create product');
    } finally { setCreating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Create Product with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* The simple form */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">Just enter the product name. AI will automatically generate the description, brand, category, specifications, keywords, and SEO information.</p>
          </div>

          <div>
            <Label className="mb-1 block text-sm">Product Name *</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setDuplicates(null); setShowPreview(false); }}
              placeholder="e.g. Samsung Galaxy S25 Ultra"
              onBlur={handleCheckDuplicate}
            />
            {checkingDup && <p className="mt-1 text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Checking for duplicates...</p>}
          </div>

          {/* Duplicate warning */}
          {duplicates && duplicates.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">Similar product already exists</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {duplicates.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded bg-background/60 px-2 py-1.5 text-sm">
                    <span>{d.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{d.brand?.name ?? 'No brand'}</Badge>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Consider using the existing product instead of creating a duplicate.</p>
            </div>
          )}

          {/* AI Preview */}
          {showPreview && generated && (
            <Card className="border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold">AI Preview</span>
                <Badge className="ml-auto bg-accent/15 text-accent">{(generated.confidence * 100).toFixed(0)}% confident</Badge>
              </div>
              <div className="space-y-1.5 text-sm">
                {generated.brand && <div><span className="text-xs text-muted-foreground">Brand:</span> <span className="font-medium">{generated.brand}</span></div>}
                {generated.category && <div><span className="text-xs text-muted-foreground">Category:</span> <span className="font-medium">{generated.category}{generated.subcategory ? ` > ${generated.subcategory}` : ''}</span></div>}
                {generated.model_number && <div><span className="text-xs text-muted-foreground">Model:</span> <span className="font-medium">{generated.model_number}</span></div>}
                <div><span className="text-xs text-muted-foreground">Description:</span> <p className="mt-0.5">{generated.description}</p></div>
                {generated.features.length > 0 && (
                  <div><span className="text-xs text-muted-foreground">Features:</span>
                    <ul className="mt-0.5 list-inside list-disc text-xs">
                      {generated.features.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {generated.low_confidence_fields.length > 0 && (
                  <div className="mt-2 rounded bg-warning/10 p-2 text-xs text-warning">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    Some specs are unavailable: {generated.low_confidence_fields.join(', ')}
                  </div>
                )}
              </div>
            </Card>
          )}

          <div>
            <Label className="mb-1 block text-sm">Product Image (Optional)</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://images.pexels.com/..." />
            {imageUrl && (
              <div className="relative mt-2 h-32 overflow-hidden rounded-lg border border-border/60 bg-muted">
                <Image src={imageUrl} alt="Preview" fill sizes="400px" className="object-contain" />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handlePreviewAI} disabled={!name.trim()}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Preview AI
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Bulk Create Dialog
// ============================================================

function BulkCreateDialog({
  open, onOpenChange, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [names, setNames] = useState('');
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, current: '' });
  const [results, setResults] = useState<{ name: string; success: boolean }[]>([]);

  const handleCreate = async () => {
    const nameList = names.split('\n').map((n) => n.trim()).filter(Boolean);
    if (nameList.length === 0) { toast.error('Enter at least one product name'); return; }
    setCreating(true);
    setResults([]);
    setProgress({ completed: 0, total: nameList.length, current: '' });
    try {
      const { results: res } = await bulkCreateProductsWithAI(nameList, (completed, total, name, success) => {
        setProgress({ completed, total, current: name });
        setResults((prev) => [...prev, { name, success }]);
      });
      const successCount = res.filter((r) => r.product).length;
      toast.success(`${successCount} / ${nameList.length} products created. Review and approve them.`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Bulk creation failed');
    } finally { setCreating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" /> Bulk Create Products with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">Enter one product name per line. AI will generate all details for each product automatically.</p>
          </div>

          <div>
            <Label className="mb-1 block text-sm">Product Names (one per line)</Label>
            <Textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder="Samsung Galaxy S25 Ultra&#10;iPhone 16 Pro Max&#10;OnePlus 13&#10;Vivo X200&#10;Oppo Find X8"
              className="min-h-[150px]"
              disabled={creating}
            />
          </div>

          {creating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Generating... {progress.completed} / {progress.total}</span>
                <span className="font-medium">{progress.current}</span>
              </div>
              <Progress value={(progress.completed / progress.total) * 100} />
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.success ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertCircle className="h-3 w-3 text-destructive" />}
                    <span className={r.success ? 'text-foreground' : 'text-destructive'}>{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleCreate} disabled={creating || !names.trim()} className="w-full">
            {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {creating ? 'Generating Products...' : 'Generate All Products'}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Review / Edit Product Dialog (with AI info review + approval)
// ============================================================

function ReviewProductDialog({
  open, onOpenChange, product, categories, brands, subcategories, onApprove, onRegenerate, onSaved,
  onCreateCategory, onCreateBrand,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product;
  categories: Category[];
  brands: Brand[];
  subcategories: Category[];
  onApprove: () => void;
  onRegenerate: () => void;
  onSaved: () => void;
  onCreateCategory: (name: string, parentId?: string | null) => Promise<Category | null>;
  onCreateBrand: (name: string) => Promise<Brand | null>;
}) {
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.category_id ?? '');
  const [subcategoryId, setSubcategoryId] = useState(product.subcategory_id ?? '');
  const [brandId, setBrandId] = useState(product.brand_id ?? '');
  const [model, setModel] = useState(product.model ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [shortDescription, setShortDescription] = useState((product as any).short_description ?? '');
  const [features, setFeatures] = useState((product.features ?? []).join('\n'));
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>(Object.entries(product.specifications ?? {}).map(([key, value]) => ({ key, value: String(value) })));
  const [tags, setTags] = useState((product.tags ?? []).join(', '));
  const [keywords, setKeywords] = useState(((product as any).keywords ?? []).join(', '));
  const [seoTitle, setSeoTitle] = useState((product as any).seo_title ?? '');
  const [seoDescription, setSeoDescription] = useState((product as any).seo_description ?? '');
  const [modelNumber, setModelNumber] = useState((product as any).model_number ?? '');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(product.is_active);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  const rootCategories = categories.filter((c) => !c.parent_id);
  const filteredSubcategories = subcategories.filter((c) => c.parent_id === categoryId);
  const aiStatus = (product as any).ai_status ?? 'pending';
  const needsApproval = aiStatus === 'generated' || aiStatus === 'pending';

  const handleAddSpec = () => setSpecs([...specs, { key: '', value: '' }]);
  const handleUpdateSpec = (i: number, field: 'key' | 'value', val: string) => setSpecs(specs.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const handleRemoveSpec = (i: number) => setSpecs(specs.filter((_, idx) => idx !== i));

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const cat = await onCreateCategory(newCategoryName.trim());
    if (cat) { setCategoryId(cat.id); setNewCategoryName(''); setShowNewCategory(false); }
  };

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return;
    const brand = await onCreateBrand(newBrandName.trim());
    if (brand) { setBrandId(brand.id); setNewBrandName(''); setShowNewBrand(false); }
  };

  const handleAddImage = async () => {
    if (!imageUrl.trim()) return;
    const { error } = await updateProductImage(product.id, imageUrl.trim());
    if (error) { toast.error(error); return; }
    toast.success('Image added');
    setImageUrl('');
    onSaved();
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Product name is required'); return; }
    setSaving(true);
    try {
      const specObj: Record<string, string> = {};
      specs.forEach((s) => { if (s.key.trim()) specObj[s.key.trim()] = s.value; });

      const input: Partial<CatalogProductInput> = {
        name: name.trim(),
        brand_id: brandId || null,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        model: model || null,
        description: description || null,
        specifications: specObj,
        features: features.split('\n').map((s: string) => s.trim()).filter(Boolean),
        tags: tags.split(',').map((s: string) => s.trim()).filter(Boolean),
        is_active: isActive,
      };

      const { error } = await updateCatalogProduct(product.id, input);
      if (error) throw error;

      // Also update AI-specific fields
      const { error: aiError } = await supabase.from('products').update({
        short_description: shortDescription || null,
        keywords: keywords.split(',').map((s: string) => s.trim()).filter(Boolean),
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        model_number: modelNumber || null,
      }).eq('id', product.id);

      if (aiError) console.warn('AI field update warning:', aiError.message);

      toast.success('Product updated');
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to save product');
    } finally { setSaving(false); }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await onRegenerate();
    setRegenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Review Product: {product.name}
            <AIStatusBadge status={aiStatus} />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Product Info</TabsTrigger>
            <TabsTrigger value="specs" className="flex-1">Specs & Features</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1">SEO & Keywords</TabsTrigger>
            <TabsTrigger value="images" className="flex-1">Images</TabsTrigger>
          </TabsList>

          {/* Product Info */}
          <TabsContent value="info" className="mt-4 space-y-3">
            <div>
              <Label className="mb-1 block text-sm">Product Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm">Category</Label>
                <div className="flex gap-1.5">
                  <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(''); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {rootCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setShowNewCategory(!showNewCategory)}><Plus className="h-4 w-4" /></Button>
                </div>
                {showNewCategory && (
                  <div className="mt-1.5 flex gap-1.5">
                    <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className="text-xs" />
                    <Button size="sm" onClick={handleCreateCategory}><Check className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-1 block text-sm">Subcategory</Label>
                <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId || filteredSubcategories.length === 0}>
                  <SelectTrigger><SelectValue placeholder={filteredSubcategories.length ? "Select" : "No subcategories"} /></SelectTrigger>
                  <SelectContent>
                    {filteredSubcategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm">Brand</Label>
                <div className="flex gap-1.5">
                  <Select value={brandId} onValueChange={setBrandId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setShowNewBrand(!showNewBrand)}><Plus className="h-4 w-4" /></Button>
                </div>
                {showNewBrand && (
                  <div className="mt-1.5 flex gap-1.5">
                    <Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="New brand name" className="text-xs" />
                    <Button size="sm" onClick={handleCreateBrand}><Check className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-1 block text-sm">Model Number</Label>
                <Input value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} placeholder="e.g. SM-S938B" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Short Description</Label>
              <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="One-line product summary" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[100px]" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Tags (comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="smartphone, android, 5g" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-sm">Active (visible to dealers)</Label>
            </div>
          </TabsContent>

          {/* Specs & Features */}
          <TabsContent value="specs" className="mt-4 space-y-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">Specifications</Label>
                <Button size="sm" variant="outline" onClick={handleAddSpec}><Plus className="mr-1 h-3.5 w-3.5" /> Add Spec</Button>
              </div>
              <div className="space-y-2">
                {specs.map((spec, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={spec.key} onChange={(e) => handleUpdateSpec(i, 'key', e.target.value)} placeholder="Key (e.g. Display)" className="flex-1" />
                    <Input value={spec.value} onChange={(e) => handleUpdateSpec(i, 'value', e.target.value)} placeholder="Value (e.g. 6.8 inch)" className="flex-1" />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSpec(i)}><X className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                {specs.length === 0 && <p className="text-sm text-muted-foreground">No specifications. AI will generate some based on the product name.</p>}
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Features (one per line)</Label>
              <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="5G connectivity&#10;200MP camera&#10;5000mAh battery" className="min-h-[80px]" />
            </div>
          </TabsContent>

          {/* SEO & Keywords */}
          <TabsContent value="seo" className="mt-4 space-y-3">
            <div>
              <Label className="mb-1 block text-sm">SEO Title</Label>
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-sm">SEO Description</Label>
              <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="min-h-[60px]" />
            </div>
            <div>
              <Label className="mb-1 block text-sm">Search Keywords (comma-separated)</Label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="samsung s25 ultra, galaxy s25, samsung flagship" />
              <p className="mt-1 text-xs text-muted-foreground">These keywords help dealers find this product with partial names and misspellings.</p>
            </div>
          </TabsContent>

          {/* Images */}
          <TabsContent value="images" className="mt-4 space-y-3">
            <div>
              <Label className="mb-1 block text-sm">Add Product Image URL</Label>
              <div className="flex gap-2">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://images.pexels.com/..." />
                <Button variant="outline" onClick={handleAddImage} disabled={!imageUrl.trim()}><Plus className="mr-1 h-4 w-4" /> Add</Button>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm">Current Images</Label>
              {product.images.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {product.images.map((url, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded border border-border/60 bg-muted">
                      <Image src={url} alt={`Image ${i + 1}`} fill sizes="120px" className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No images yet. Upload a product image or use AI to generate one.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Regenerate with AI
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save Changes
            </Button>
            {needsApproval && (
              <Button onClick={onApprove} className="bg-success hover:bg-success/90">
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve Product
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
