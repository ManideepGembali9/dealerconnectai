'use client';

import { useState } from 'react';
import {
  Palette,
  Layout,
  Type,
  Image as ImageIcon,
  Sliders,
  Save,
  Check,
  Sparkles,
  Store,
  Layers,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/providers';
import type { ThemePreset, AppSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const THEMES: { id: ThemePreset; name: string; tag: string; colors: string[]; bgClass: string; borderClass: string }[] = [
  {
    id: 'black-white',
    name: 'Black & White Monochrome (Default)',
    tag: 'Minimalist Modern High Contrast',
    colors: ['#09090b', '#18181b', '#71717a', '#e4e4e7', '#ffffff'],
    bgClass: 'bg-card text-foreground',
    borderClass: 'border-border',
  },
  {
    id: 'gold-navy',
    name: 'Deep Slate & Charcoal',
    tag: 'Executive Dark Mode',
    colors: ['#09090b', '#27272a', '#52525b', '#ffffff'],
    bgClass: 'bg-card text-foreground',
    borderClass: 'border-border',
  },
  {
    id: 'gold-sand',
    name: 'Golden Sand & White',
    tag: 'Warm Clean Sunlight',
    colors: ['#EDC65A', '#FFFFFF', '#2C2F3F', '#FAF283'],
    bgClass: 'bg-[#FFFFFF] text-[#2C2F3F]',
    borderClass: 'border-[#EDC65A]',
  },
  {
    id: 'navy-light',
    name: 'Soft Gold & Navy',
    tag: 'Airy & Modern Contrast',
    colors: ['#F3DA6C', '#2C2F3F', '#FAF283', '#FFFFFF'],
    bgClass: 'bg-white text-[#2C2F3F]',
    borderClass: 'border-[#F3DA6C]',
  },
];

export function AdminAppControlTab() {
  const { appSettings, updateAppSettings, setThemePreset } = useApp();

  const [form, setForm] = useState<AppSettings>({ ...appSettings });
  const [saving, setSaving] = useState(false);

  const handleSelectTheme = async (themeId: ThemePreset) => {
    setForm((prev) => ({ ...prev, theme_preset: themeId }));
    await setThemePreset(themeId);
    toast.success(`Active theme changed to ${THEMES.find((t) => t.id === themeId)?.name}`);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAppSettings(form);
      toast.success('App branding, homepage design, and settings saved successfully!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (id: string, enabled: boolean) => {
    const currentSections = form.homepage_config?.sections || [];
    const updated = currentSections.map((s) => (s.id === id ? { ...s, enabled } : s));
    setForm((p) => ({
      ...p,
      homepage_config: {
        ...(p.homepage_config as any),
        sections: updated,
      },
    }));
  };

  const updateBanner = (index: number, field: string, val: any) => {
    const banners = [...(form.homepage_config?.banners || [])];
    if (banners[index]) {
      banners[index] = { ...banners[index], [field]: val };
      setForm((p) => ({
        ...p,
        homepage_config: {
          ...(p.homepage_config as any),
          banners,
        },
      }));
    }
  };

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      {/* 1. THEME SELECTION PANEL */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" /> Application Dynamic Colour Themes
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Change the overall look & feel across all customer, dealer, and admin interfaces in real time.
            </p>
          </div>
          <Badge className="font-bold uppercase tracking-wider text-xs">
            Current: {form.theme_preset.replace('-', ' ')}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {THEMES.map((th) => {
            const isSelected = form.theme_preset === th.id;
            return (
              <div
                key={th.id}
                onClick={() => handleSelectTheme(th.id)}
                className={cn(
                  'cursor-pointer relative overflow-hidden rounded-2xl border-2 p-4 transition-all duration-200 hover:scale-[1.02]',
                  isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20 bg-card' : 'border-border/60 hover:border-border bg-card/60'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{th.name}</h4>
                    <span className="text-[11px] text-muted-foreground font-medium">{th.tag}</span>
                  </div>
                  {isSelected && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                {/* Swatches preview */}
                <div className="flex items-center gap-2 mb-2">
                  {th.colors.map((c, i) => (
                    <span
                      key={i}
                      className="h-6 w-6 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className={cn('rounded-lg p-2 text-[10px] font-semibold text-center mt-2', th.bgClass)}>
                  Live Palette Preview
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2. APP IDENTITY & BRANDING */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <div className="pb-4 border-b border-border/40">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> App Identity, Logo & Name
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure application title, logo image URL, and subtitle displayed in header and PWA.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">App Title / Brand Name</Label>
            <Input
              value={form.app_name}
              onChange={(e) => setForm((p) => ({ ...p, app_name: e.target.value }))}
              className="rounded-xl text-sm"
              placeholder="e.g. DealerConnect AI"
              required
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Tagline / Slogan</Label>
            <Input
              value={form.tagline || ''}
              onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
              className="rounded-xl text-sm"
              placeholder="e.g. Your Smart Local Dealer Marketplace"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Logo Image URL</Label>
            <Input
              value={form.logo_url || ''}
              onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
              className="rounded-xl text-sm"
              placeholder="https://..."
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold">App Icon Emoji</Label>
            <Input
              value={form.icon_emoji || '🏪'}
              onChange={(e) => setForm((p) => ({ ...p, icon_emoji: e.target.value }))}
              className="rounded-xl text-sm"
              placeholder="🏪"
            />
          </div>
        </div>
      </Card>

      {/* 3. HOMEPAGE DESIGN & SECTION TOGGLES */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <div className="pb-4 border-b border-border/40">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" /> Homepage Design & Sections Visibility
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Turn sections on or off, and customize headings and descriptions shown on the main page.
          </p>
        </div>

        {/* Section Toggles */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div>
              <h4 className="text-sm font-semibold">Hero Search Banner</h4>
              <p className="text-xs text-muted-foreground">The prominent top banner with search input and live GPS pill.</p>
            </div>
            <Switch
              checked={form.homepage_config?.sections?.find((s) => s.type === 'banner')?.enabled ?? true}
              onCheckedChange={(v) => updateSection('sec-hero', v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div>
              <h4 className="text-sm font-semibold">Top Categories Grid</h4>
              <p className="text-xs text-muted-foreground">Quick category chips for Electronics, Appliances, Fashion, etc.</p>
            </div>
            <Switch
              checked={form.homepage_config?.sections?.find((s) => s.type === 'categories')?.enabled ?? true}
              onCheckedChange={(v) => updateSection('sec-categories', v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div>
              <h4 className="text-sm font-semibold">Handpicked Deals / Featured Products</h4>
              <p className="text-xs text-muted-foreground">Product cards with real-time dealer pricing and instant add-to-cart.</p>
            </div>
            <Switch
              checked={form.homepage_config?.sections?.find((s) => s.type === 'products')?.enabled ?? true}
              onCheckedChange={(v) => updateSection('sec-featured', v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div>
              <h4 className="text-sm font-semibold">Top Verified Dealers Showcases</h4>
              <p className="text-xs text-muted-foreground">Neighborhood shops with distance calculation, WhatsApp, and call actions.</p>
            </div>
            <Switch
              checked={form.homepage_config?.sections?.find((s) => s.type === 'dealers')?.enabled ?? true}
              onCheckedChange={(v) => updateSection('sec-dealers', v)}
            />
          </div>
        </div>

        {/* Headings & Text Configuration */}
        <div className="mt-6 pt-5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-semibold">Hero Headline</Label>
            <Input
              value={form.homepage_config?.headings?.hero_title || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  homepage_config: {
                    ...(p.homepage_config as any),
                    headings: { ...(p.homepage_config?.headings || {}), hero_title: e.target.value },
                  },
                }))
              }
              className="rounded-xl text-sm"
              placeholder="Find What You Need. Near You."
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-semibold">Hero Subtitle</Label>
            <Textarea
              value={form.homepage_config?.headings?.hero_subtitle || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  homepage_config: {
                    ...(p.homepage_config as any),
                    headings: { ...(p.homepage_config?.headings || {}), hero_subtitle: e.target.value },
                  },
                }))
              }
              rows={2}
              className="rounded-xl text-sm"
              placeholder="Search genuine products, discover verified local dealers, compare prices live..."
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Featured Products Section Title</Label>
            <Input
              value={form.homepage_config?.headings?.featured_title || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  homepage_config: {
                    ...(p.homepage_config as any),
                    headings: { ...(p.homepage_config?.headings || {}), featured_title: e.target.value },
                  },
                }))
              }
              className="rounded-xl text-sm"
              placeholder="Handpicked Deals Today"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Dealers Section Title</Label>
            <Input
              value={form.homepage_config?.headings?.dealers_title || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  homepage_config: {
                    ...(p.homepage_config as any),
                    headings: { ...(p.homepage_config?.headings || {}), dealers_title: e.target.value },
                  },
                }))
              }
              className="rounded-xl text-sm"
              placeholder="Top Verified Neighborhood Dealers"
            />
          </div>
        </div>
      </Card>

      {/* 4. PROMOTIONAL BANNERS */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <div className="pb-4 border-b border-border/40">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" /> Promotional Banners
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure image banners and call-to-action buttons on the homepage.
          </p>
        </div>

        <div className="mt-5 space-y-6">
          {(form.homepage_config?.banners || []).map((b, i) => (
            <div key={b.id || i} className="rounded-xl border border-border/60 p-4 bg-muted/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Banner #{i + 1}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Enabled:</span>
                  <Switch checked={b.enabled} onCheckedChange={(v) => updateBanner(i, 'enabled', v)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs font-semibold">Banner Heading</Label>
                  <Input
                    value={b.title}
                    onChange={(e) => updateBanner(i, 'title', e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-semibold">Subtitle / Promo Text</Label>
                  <Input
                    value={b.subtitle}
                    onChange={(e) => updateBanner(i, 'subtitle', e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-semibold">Banner Image URL</Label>
                  <Input
                    value={b.image_url}
                    onChange={(e) => updateBanner(i, 'image_url', e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-semibold">Click Action Link</Label>
                  <Input
                    value={b.link}
                    onChange={(e) => updateBanner(i, 'link', e.target.value)}
                    className="rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SAVE BUTTON */}
      <div className="sticky bottom-6 z-20 flex justify-end">
        <Button type="submit" size="lg" className="rounded-2xl px-8 font-bold shadow-xl text-base" disabled={saving}>
          <Save className="mr-2 h-5 w-5" />
          {saving ? 'Saving...' : 'Save & Broadcast All Changes Live'}
        </Button>
      </div>
    </form>
  );
}
