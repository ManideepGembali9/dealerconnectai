'use client';

import { useState } from 'react';
import {
  PanelsTopLeft, ArrowUp, ArrowDown, Eye, Plus, Save, Trash2,
  Image as ImageIcon, Sparkles, CheckCircle2, RotateCcw, Sliders
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useApp } from '@/lib/providers';
import type { AppSettings, Product, Dealer, Category } from '@/lib/types';
import { toast } from 'sonner';

type Module10Props = {
  products: Product[];
  dealers: Dealer[];
  categories: Category[];
};

export function Module10Homepage({ products, dealers, categories }: Module10Props) {
  const { appSettings, updateAppSettings } = useApp();
  const [config, setConfig] = useState(() => JSON.parse(JSON.stringify(appSettings.homepage_config || {})));
  const [saving, setSaving] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const sections = config.sections || [];
  const banners = config.banners || [];

  const handleToggleSection = (id: string, enabled: boolean) => {
    setConfig((prev: any) => ({
      ...prev,
      sections: (prev.sections || []).map((s: any) => (s.id === id ? { ...s, enabled } : s)),
    }));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setConfig((prev: any) => ({ ...prev, sections: updated }));
  };

  const handleUpdateHeading = (field: string, value: string) => {
    setConfig((prev: any) => ({
      ...prev,
      headings: {
        ...(prev.headings || {}),
        [field]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await updateAppSettings({
        homepage_config: config,
      });
      toast.success('Customer homepage layout & banners published successfully!');
    } catch {
      toast.error('Failed to save homepage settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;

    setConfig((prev: any) => {
      const existing = prev.banners || [];
      const idx = existing.findIndex((b: any) => b.id === editingBanner.id);
      if (idx >= 0) {
        const next = [...existing];
        next[idx] = editingBanner;
        return { ...prev, banners: next };
      }
      return { ...prev, banners: [...existing, editingBanner] };
    });

    setEditingBanner(null);
    toast.success('Banner updated in layout draft');
  };

  const handleDeleteBanner = (id: string) => {
    setConfig((prev: any) => ({
      ...prev,
      banners: (prev.banners || []).filter((b: any) => b.id !== id),
    }));
    toast.success('Banner removed from layout');
  };

  const handleAddNewBanner = () => {
    setEditingBanner({
      id: `ban-${Date.now()}`,
      title: 'Exciting Seasonal Offers',
      subtitle: 'Exclusive discounts from verified local dealerships',
      image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600',
      link: '/search',
      enabled: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <PanelsTopLeft className="h-7 w-7 text-primary" /> Homepage Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Control customer app homepage arrangement, promotional hero banners & section visibility
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className="font-semibold gap-1.5"
          >
            <Eye className="h-4 w-4" /> Live Preview
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving}
            className="font-bold gap-1.5 shadow-md"
          >
            <Save className="h-4 w-4" /> {saving ? 'Publishing...' : 'Save & Publish'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sections">
        <TabsList className="h-9">
          <TabsTrigger value="sections" className="text-xs font-semibold">
            Section Arrangement ({sections.length})
          </TabsTrigger>
          <TabsTrigger value="banners" className="text-xs font-semibold">
            Hero Banners ({banners.length})
          </TabsTrigger>
          <TabsTrigger value="headings" className="text-xs font-semibold">
            Headings & Content
          </TabsTrigger>
        </TabsList>

        {/* SECTIONS TAB */}
        <TabsContent value="sections" className="mt-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            Reorder sections or toggle their visibility. Changes will immediately take effect on the customer app when published.
          </div>

          <Card className="border-border/80 overflow-hidden divide-y divide-border/60">
            {sections.map((sec: any, index: number) => (
              <div
                key={sec.id || index}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveSection(index, 'up')}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sections.length - 1}
                      onClick={() => handleMoveSection(index, 'down')}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                        #{index + 1}
                      </span>
                      {sec.title}
                    </div>
                    {sec.subtitle && (
                      <p className="text-[11px] text-muted-foreground">{sec.subtitle}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={sec.enabled ? 'default' : 'secondary'} className="text-[10px]">
                    {sec.enabled ? 'Visible' : 'Hidden'}
                  </Badge>
                  <Switch
                    checked={sec.enabled ?? true}
                    onCheckedChange={(checked) => handleToggleSection(sec.id, checked)}
                  />
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* BANNERS TAB */}
        <TabsContent value="banners" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Promotional hero carousel banners displayed prominently at the top of the Customer App.
            </div>
            <Button size="sm" onClick={handleAddNewBanner} className="font-semibold text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Banner
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {banners.map((ban: any, index: number) => (
              <Card key={ban.id || index} className="p-4 border-border/80 flex flex-col justify-between">
                <div>
                  <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden bg-muted border border-border/50 mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ban.image_url}
                      alt={ban.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{ban.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{ban.subtitle}</p>
                  <p className="text-[11px] font-mono text-primary mt-1">Link: {ban.link || '/'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                  <Badge variant={ban.enabled ? 'default' : 'secondary'} className="text-[10px]">
                    {ban.enabled ? 'Active Banner' : 'Disabled'}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingBanner(ban)}
                      className="h-7 px-2 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteBanner(ban.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* HEADINGS TAB */}
        <TabsContent value="headings" className="mt-4 space-y-4">
          <Card className="p-5 border-border/80 space-y-4">
            <div>
              <Label className="text-xs font-semibold">Hero Main Title</Label>
              <Input
                value={config.headings?.hero_title || ''}
                onChange={(e) => handleUpdateHeading('hero_title', e.target.value)}
                placeholder="Local Shop Product Finder"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Hero Subtitle</Label>
              <Input
                value={config.headings?.hero_subtitle || ''}
                onChange={(e) => handleUpdateHeading('hero_subtitle', e.target.value)}
                placeholder="Discover genuine products in your neighborhood..."
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Dealers Section Header</Label>
              <Input
                value={config.headings?.dealers_title || ''}
                onChange={(e) => handleUpdateHeading('dealers_title', e.target.value)}
                placeholder="Top Verified Neighborhood Dealers"
                className="mt-1 h-9 text-xs"
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Banner Dialog */}
      <Dialog open={!!editingBanner} onOpenChange={(open) => !open && setEditingBanner(null)}>
        {editingBanner && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" /> Edit Hero Banner
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure banner image, headlines, and destination link
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveBanner} className="space-y-3 py-2 text-xs">
              <div>
                <Label className="text-xs font-semibold">Banner Title</Label>
                <Input
                  value={editingBanner.title || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                  placeholder="e.g. Compare Prices & Buy Local"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Banner Subtitle</Label>
                <Input
                  value={editingBanner.subtitle || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                  placeholder="e.g. Instant stock & doorstep delivery"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Banner Image URL</Label>
                <Input
                  value={editingBanner.image_url || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Action Link</Label>
                <Input
                  value={editingBanner.link || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, link: e.target.value })}
                  placeholder="/search or /categories"
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-xs font-semibold">Banner Enabled</Label>
                <Switch
                  checked={editingBanner.enabled ?? true}
                  onCheckedChange={(checked) =>
                    setEditingBanner({ ...editingBanner, enabled: checked })
                  }
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingBanner(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="font-semibold">
                  Update Banner
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Live Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Customer Homepage Preview
            </DialogTitle>
            <DialogDescription className="text-xs">
              Simulated customer screen based on your current section order & active banners
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 rounded-2xl border border-border/80 bg-background p-4 text-xs">
            {/* Banner preview */}
            {banners.filter((b: any) => b.enabled).length > 0 && (
              <div className="relative aspect-[21/9] w-full rounded-xl overflow-hidden bg-muted border border-border/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={banners.filter((b: any) => b.enabled)[0]?.image_url}
                  alt="Hero Preview"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4 text-white">
                  <h3 className="font-bold text-sm">
                    {banners.filter((b: any) => b.enabled)[0]?.title}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    {banners.filter((b: any) => b.enabled)[0]?.subtitle}
                  </p>
                </div>
              </div>
            )}

            {/* Render enabled sections list preview */}
            <div className="space-y-2">
              <span className="font-bold text-foreground text-xs block">Active Content Flow:</span>
              {sections
                .filter((s: any) => s.enabled)
                .map((s: any, idx: number) => (
                  <div
                    key={s.id || idx}
                    className="p-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between"
                  >
                    <span className="font-semibold text-foreground">
                      {idx + 1}. {s.title}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Active
                    </Badge>
                  </div>
                ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
