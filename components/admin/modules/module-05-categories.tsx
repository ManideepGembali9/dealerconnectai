'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,DialogContent,DialogDescription,
  DialogFooter,
  DialogHeader,DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,SelectContent,SelectItem,SelectTrigger,SelectValue,
} from '@/components/ui/select';
import { deleteDbCategory, getDbCategoryGroups,saveDbCategory } from '@/lib/firebase-db';
import type { Category,Product } from '@/lib/types';
import {
  ArrowDown,
  ArrowUp,
  Edit,
  FolderTree,Plus,Search,
  Trash2
} from 'lucide-react';
import { useEffect, useMemo,useState } from 'react';
import { toast } from 'sonner';

type Module05Props = {
  categories: Category[];
  products: Product[];
  onRefreshCategories: () => Promise<void>;
};

export function Module05Categories({ categories, products, onRefreshCategories }: Module05Props) {
  const [cats, setCats] = useState<Category[]>(categories);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const groups = useMemo(() => getDbCategoryGroups(), []);

  // Sync when prop updates
  useEffect(() => {
    setCats(categories);
  }, [categories]);

  const productCountsByCat = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category_id) {
        map[p.category_id] = (map[p.category_id] || 0) + 1;
      }
    });
    return map;
  }, [products]);

  const filteredCategories = useMemo(() => {
    return cats
      .filter((c) => {
        if (selectedGroup !== 'all' && c.group_id !== selectedGroup) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchName = c.name.toLowerCase().includes(q);
          const matchSub = c.subcategories?.some((s) => s.toLowerCase().includes(q));
          if (!matchName && !matchSub) return false;
        }
        return true;
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [cats, selectedGroup, search]);

  const moveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredCategories.length) return;

    const currentItem = filteredCategories[index];
    const targetItem = filteredCategories[targetIndex];

    const currentOrder = currentItem.sort_order;
    const targetOrder = targetItem.sort_order;

    const updatedCurrent = { ...currentItem, sort_order: targetOrder };
    const updatedTarget = { ...targetItem, sort_order: currentOrder };

    setCats((prev) =>
      prev.map((c) => {
        if (c.id === updatedCurrent.id) return updatedCurrent;
        if (c.id === updatedTarget.id) return updatedTarget;
        return c;
      })
    );

    try {
      await saveDbCategory(updatedCurrent);
      await saveDbCategory(updatedTarget);
      toast.success('Category order updated');
    } catch {
      toast.error('Failed to update category order');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSaving(true);
    try {
      await saveDbCategory(editingCategory);
      setCats((prev) => {
        const idx = prev.findIndex((c) => c.id === editingCategory.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = editingCategory;
          return clone;
        }
        return [...prev, editingCategory];
      });
      setFeedback({ type: 'success', text: `Category "${editingCategory.name}" saved and synced.` });
      toast.success('Category saved successfully!');
      setEditingCategory(null);
      setIsCreating(false);
      await onRefreshCategories();
    } catch {
      setFeedback({ type: 'error', text: 'Failed to save category' });
      toast.error('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the category "${name}"?`)) return;
    try {
      await deleteDbCategory(id);
      setCats((prev) => prev.filter((c) => c.id !== id));
      setFeedback({ type: 'success', text: `Category "${name}" removed permanently.` });
      toast.success(`Category "${name}" removed`);
      await onRefreshCategories();
    } catch {
      setFeedback({ type: 'error', text: 'Failed to delete category' });
      toast.error('Failed to delete category');
    }
  };

  const openNewCategoryModal = () => {
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: '',
      slug: '',
      icon: 'Tag',
      group_id: groups[0]?.id || 'grp-electronics',
      group_name: groups[0]?.name || 'Electronics & Technology',
      description: '',
      sort_order: cats.length + 1,
      subcategories: [],
    };
    setEditingCategory(newCat);
    setIsCreating(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <FolderTree className="h-7 w-7 text-primary" /> Category Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Configure the 8 master category groups, 30 subcategories, icon sets & customer display order
          </p>
        </div>

        <Button onClick={openNewCategoryModal} className="font-semibold gap-1.5 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add Category
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

      {/* 8 Groups Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant={selectedGroup === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedGroup('all')}
          className="h-8 text-xs font-semibold whitespace-nowrap"
        >
          All Groups ({cats.length})
        </Button>
        {groups.map((g) => {
          const count = cats.filter((c) => c.group_id === g.id).length;
          return (
            <Button
              key={g.id}
              size="sm"
              variant={selectedGroup === g.id ? 'default' : 'outline'}
              onClick={() => setSelectedGroup(g.id)}
              className="h-8 text-xs font-semibold whitespace-nowrap"
            >
              {g.name} ({count})
            </Button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search categories or subcategories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Mobile Categories Cards (< 768px) */}
      <div className="md:hidden space-y-2.5">
        {filteredCategories.map((c, index) => (
          <Card key={c.id} className="p-3.5 border-border/80 rounded-2xl space-y-2 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground truncate">{c.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground">/{c.slug} • Order #{c.sort_order}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="outline" disabled={index === 0} onClick={() => moveOrder(index, 'up')} className="h-7 w-7" title="Move Up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" disabled={index === filteredCategories.length - 1} onClick={() => moveOrder(index, 'down')} className="h-7 w-7" title="Move Down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground">
              <span>{c.group_name}</span>
              <span>{(c.subcategories || []).length} sub • {products.filter((p) => p.category_id === c.id).length} items</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Categories Table (>= 768px) */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-3 py-3 text-center w-16">Order</th>
                <th className="px-4 py-3">Category Name & Slug</th>
                <th className="px-4 py-3">Assigned Group</th>
                <th className="px-4 py-3">Subcategories</th>
                <th className="px-4 py-3">Live Products</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredCategories.map((c, index) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  {/* Order & Reorder Buttons */}
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-mono text-xs font-bold text-muted-foreground w-5 text-right">
                        {c.sort_order}
                      </span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveOrder(index, 'up')}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                          title="Move Up"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={index === filteredCategories.length - 1}
                          onClick={() => moveOrder(index, 'down')}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                          title="Move Down"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Name & Slug */}
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground text-xs sm:text-sm">{c.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">/{c.slug}</div>
                    {c.description && (
                      <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {c.description}
                      </div>
                    )}
                  </td>

                  {/* Group */}
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {c.group_name}
                    </Badge>
                  </td>

                  {/* Subcategories */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {c.subcategories && c.subcategories.length > 0 ? (
                        c.subcategories.slice(0, 3).map((sub, i) => (
                          <span
                            key={i}
                            className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium"
                          >
                            {sub}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-[10px]">None</span>
                      )}
                      {c.subcategories && c.subcategories.length > 3 && (
                        <span className="text-muted-foreground text-[10px]">
                          +{c.subcategories.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Live Products */}
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-[11px] font-bold">
                      {productCountsByCat[c.id] || 0} Products
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingCategory(c);
                        setIsCreating(false);
                      }}
                      className="h-8 px-2 text-[11px] font-semibold"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="h-8 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        {editingCategory && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                {isCreating ? 'Add New Category' : `Edit Category: ${editingCategory.name}`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure category hierarchy, assigned group, and subcategories
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCategory} className="space-y-3.5 py-2">
              <div>
                <Label className="text-xs font-semibold">Category Name</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)+/g, '');
                    setEditingCategory({
                      ...editingCategory,
                      name,
                      slug: isCreating ? slug : editingCategory.slug,
                    });
                  }}
                  placeholder="e.g. 5G Smartphones"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Category URL Slug</Label>
                <Input
                  value={editingCategory.slug}
                  onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                  placeholder="e.g. 5g-smartphones"
                  className="mt-1 h-9 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Assign to Major Group</Label>
                <Select
                  value={editingCategory.group_id}
                  onValueChange={(val) => {
                    const g = groups.find((x) => x.id === val);
                    setEditingCategory({
                      ...editingCategory,
                      group_id: val,
                      group_name: g?.name || 'Electronics & Technology',
                    });
                  }}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id} className="text-xs">
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Subcategories (Comma separated)</Label>
                <Input
                  value={editingCategory.subcategories?.join(', ') || ''}
                  onChange={(e) => {
                    const parts = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setEditingCategory({ ...editingCategory, subcategories: parts });
                  }}
                  placeholder="Flagship Mobiles, Budget Phones, Refurbished"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Display Sort Order</Label>
                <Input
                  type="number"
                  value={editingCategory.sort_order}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      sort_order: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="mt-1 h-9 text-xs w-28"
                  min={1}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="font-semibold">
                  {saving ? 'Saving...' : 'Save Category'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
