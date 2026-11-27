'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteDbBrand, saveDbBrand } from '@/lib/firebase-db';
import type { Brand, Product } from '@/lib/types';
import {
  Building2,
  Edit,
  Plus, Search,
  Trash2
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Module06Props = {
  brands: Brand[];
  products: Product[];
  onRefreshBrands?: () => Promise<void>;
};

export function Module06Brands({ brands: initialBrands, products, onRefreshBrands }: Module06Props) {
  const [brands, setBrands] = useState<Array<Brand & { is_enabled?: boolean }>>(
    initialBrands.map((b) => ({ ...b, is_enabled: b.is_enabled ?? true }))
  );
  const [search, setSearch] = useState('');
  const [editingBrand, setEditingBrand] = useState<(Brand & { is_enabled?: boolean }) | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync with prop
  useEffect(() => {
    setBrands(
      initialBrands.map((b) => ({
        ...b,
        is_enabled: b.is_enabled ?? true,
      }))
    );
  }, [initialBrands]);

  const productCountsByBrand = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.brand_id) {
        map[p.brand_id] = (map[p.brand_id] || 0) + 1;
      }
    });
    return map;
  }, [products]);

  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      if (search) {
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q);
      }
      return true;
    });
  }, [brands, search]);

  const handleToggleBrand = async (id: string) => {
    const current = brands.find((b) => b.id === id);
    if (!current) return;
    const nextEnabled = !(current.is_enabled ?? true);
    const updated: Brand = { ...current, is_enabled: nextEnabled, updated_at: new Date().toISOString() };
    setBrands((prev) => prev.map((b) => (b.id === id ? updated : b)));
    try {
      await saveDbBrand(updated);
      setFeedback({ type: 'success', text: `Brand "${current.name}" ${nextEnabled ? 'enabled' : 'disabled'} and saved.` });
      toast.success('Brand status updated');
      if (onRefreshBrands) await onRefreshBrands();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to update brand status' });
      toast.error('Failed to update brand status');
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    setSaving(true);
    try {
      const toSave: Brand = {
        ...editingBrand,
        name: editingBrand.name.trim(),
        slug: editingBrand.slug.trim(),
        is_enabled: editingBrand.is_enabled ?? true,
        updated_at: new Date().toISOString(),
      };
      await saveDbBrand(toSave);
      if (isCreating) {
        setBrands((prev) => [toSave, ...prev]);
        setFeedback({ type: 'success', text: `Brand "${toSave.name}" created and saved.` });
        toast.success(`Brand "${toSave.name}" created successfully`);
      } else {
        setBrands((prev) => prev.map((b) => (b.id === toSave.id ? toSave : b)));
        setFeedback({ type: 'success', text: `Brand "${toSave.name}" updated.` });
        toast.success(`Brand "${toSave.name}" updated`);
      }
      setEditingBrand(null);
      setIsCreating(false);
      if (onRefreshBrands) await onRefreshBrands();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to save brand' });
      toast.error('Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBrand = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the brand "${name}"?`)) return;
    try {
      await deleteDbBrand(id);
      setBrands((prev) => prev.filter((b) => b.id !== id));
      setFeedback({ type: 'success', text: `Brand "${name}" removed.` });
      toast.success(`Brand "${name}" removed`);
      if (onRefreshBrands) await onRefreshBrands();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to delete brand' });
      toast.error('Failed to remove brand');
    }
  };

  const openNewBrandModal = () => {
    const newBrand: Brand & { is_enabled?: boolean } = {
      id: `brand-${Date.now()}`,
      name: '',
      slug: '',
      logo_url: null,
      is_enabled: true,
    };
    setEditingBrand(newBrand);
    setIsCreating(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Brand Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Manage manufacturer brands, official logos, brand assignments & storefront visibility
          </p>
        </div>

        <Button onClick={openNewBrandModal} className="font-semibold gap-1.5 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add Brand
        </Button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 ${feedback.type === 'success'
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

      {/* Search Bar */}
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search brands (Samsung, LG, Apple...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Brands Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredBrands.map((b) => {
          const count = productCountsByBrand[b.id] || 0;
          return (
            <Card
              key={b.id}
              className="p-4 border-border/80 flex flex-col justify-between shadow-sm transition-all hover:border-primary/50"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-primary font-bold text-sm border border-border/50">
                    {b.name.charAt(0)}
                  </div>
                  <Badge
                    variant={b.is_enabled ? 'default' : 'secondary'}
                    className="text-[10px] cursor-pointer"
                    onClick={() => handleToggleBrand(b.id)}
                  >
                    {b.is_enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-sm text-foreground">{b.name}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground">/{b.slug}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  {count} Assigned {count === 1 ? 'Product' : 'Products'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingBrand(b);
                      setIsCreating(false);
                    }}
                    className="h-7 w-7 p-0"
                    title="Edit Brand"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBrand(b.id, b.name)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete Brand"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Brand Dialog */}
      <Dialog open={!!editingBrand} onOpenChange={(open) => !open && setEditingBrand(null)}>
        {editingBrand && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {isCreating ? 'Add Authorized Brand' : `Edit Brand: ${editingBrand.name}`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Assign brand identity and storefront filtering details
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveBrand} className="space-y-3.5 py-2">
              <div>
                <Label className="text-xs font-semibold">Brand Name</Label>
                <Input
                  value={editingBrand.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)+/g, '');
                    setEditingBrand({
                      ...editingBrand,
                      name,
                      slug: isCreating ? slug : editingBrand.slug,
                    });
                  }}
                  placeholder="e.g. Sony"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Brand Slug</Label>
                <Input
                  value={editingBrand.slug}
                  onChange={(e) => setEditingBrand({ ...editingBrand, slug: e.target.value })}
                  placeholder="e.g. sony"
                  className="mt-1 h-9 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Logo Image URL (Optional)</Label>
                <Input
                  value={editingBrand.logo_url || ''}
                  onChange={(e) =>
                    setEditingBrand({ ...editingBrand, logo_url: e.target.value || null })
                  }
                  placeholder="https://images.unsplash.com/..."
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingBrand(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="font-semibold">
                  {saving ? 'Saving...' : 'Save Brand'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
