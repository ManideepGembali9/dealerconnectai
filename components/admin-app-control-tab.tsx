'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/lib/providers';
import { INITIAL_APP_SETTINGS } from '@/lib/seed-data';
import type { AppSettings, ThemePreset } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Check,
  Eye,
  Image as ImageIcon,
  Layout,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Store,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const THEMES: { id: ThemePreset; name: string; tag: string; colors: string[] }[] = [
  {
    id: 'black-white',
    name: 'Black & White Monochrome',
    tag: 'Minimalist High Contrast (Default)',
    colors: ['#171717', '#27272a', '#71717a', '#f4f4f5'],
  },
  {
    id: 'emerald',
    name: 'Emerald Commerce',
    tag: 'Fresh Local Market Green',
    colors: ['#059669', '#10b981', '#ecfdf5', '#d1fae5'],
  },
  {
    id: 'ocean',
    name: 'Ocean Sapphire',
    tag: 'Crisp Trustworthy Blue',
    colors: ['#0284c7', '#0ea5e9', '#f0f9ff', '#e0f2fe'],
  },
  {
    id: 'royal-purple',
    name: 'Royal Violet',
    tag: 'Modern Tech & Luxury',
    colors: ['#7c3aed', '#8b5cf6', '#f5f3ff', '#ede9fe'],
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    tag: 'Warm Retail Energy',
    colors: ['#ea580c', '#f97316', '#fff7ed', '#ffedd5'],
  },
  {
    id: 'gold-navy',
    name: 'Executive Gold & Navy',
    tag: 'Premium Dark Header',
    colors: ['#d4a017', '#0f172a', '#1e293b', '#fef3c7'],
  },
];

export function AdminAppControlTab() {
  const { appSettings, updateAppSettings, setThemePreset } = useApp();

  const [form, setForm] = useState<AppSettings>({ ...appSettings });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...appSettings });
  }, [appSettings]);

  const handleSelectTheme = async (themeId: ThemePreset) => {
    const presetColors = THEMES.find((t) => t.id === themeId)?.colors || ['#171717', '#f4f4f5', '#ececed'];
    setForm((prev) => ({
      ...prev,
      theme_preset: themeId,
      primary_color: presetColors[0],
      secondary_color: presetColors[1],
      accent_color: presetColors[2],
      custom_colors: null,
    }));
    await setThemePreset(themeId);
    toast.success(`Theme switched to ${THEMES.find((t) => t.id === themeId)?.name} across all portals!`);
  };

  const updateCustomColor = (key: NonNullable<keyof NonNullable<AppSettings['custom_colors']>>, val: string) => {
    setForm((prev) => ({
      ...prev,
      primary_color: key === 'primary' ? val : prev.primary_color,
      secondary_color: key === 'secondary' ? val : prev.secondary_color,
      accent_color: key === 'accent' ? val : prev.accent_color,
      custom_colors: {
        ...(prev.custom_colors || {}),
        [key]: val,
      },
    }));
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAppSettings(form);
      toast.success('Theme, branding & homepage CMS published live to Customer and Dealer Apps!');
    } catch {
      toast.error('Failed to publish settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    try {
      const resetSettings: AppSettings = {
        ...INITIAL_APP_SETTINGS,
        updated_at: new Date().toISOString(),
        updated_by: 'admin',
      };
      setForm(resetSettings);
      await updateAppSettings(resetSettings);
      toast.success('Theme and branding restored to default system values.');
    } catch {
      toast.error('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (typeOrId: string, enabled: boolean) => {
    const currentSections = form.homepage_config?.sections || [];
    const updated = currentSections.map((s) =>
      s.id === typeOrId || s.type === typeOrId ? { ...s, enabled } : s
    );
    setForm((p) => ({
      ...p,
      homepage_config: {
        ...(p.homepage_config as NonNullable<AppSettings['homepage_config']>),
        sections: updated,
      },
    }));
  };

  const updateBanner = (index: number, field: string, val: string | boolean) => {
    const banners = [...(form.homepage_config?.banners || [])];
    if (banners[index]) {
      banners[index] = { ...banners[index], [field]: val };
      setForm((p) => ({
        ...p,
        homepage_config: {
          ...(p.homepage_config as NonNullable<AppSettings['homepage_config']>),
          banners,
        },
      }));
    }
  };

  const previewPrimary = form.custom_colors?.button || form.custom_colors?.primary || form.primary_color || '#171717';
  const previewHeader = form.custom_colors?.header || '#171717';
  const previewAccent = form.custom_colors?.accent || form.accent_color || '#ececed';

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      {/* 1. THEME PRESETS */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border/40">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" /> Application Colour Theme Presets
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a preset palette or fine-tune individual custom colors below. Changes propagate in real time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="font-bold uppercase tracking-wider text-xs">
              Active: {form.theme_preset.replace('-', ' ')}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={handleResetToDefault}
              className="h-8 text-xs font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Default
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {THEMES.map((th) => {
            const isSelected = form.theme_preset === th.id;
            return (
              <div
                key={th.id}
                onClick={() => handleSelectTheme(th.id)}
                className={cn(
                  'cursor-pointer relative overflow-hidden rounded-2xl border-2 p-4 transition-all duration-200 hover:scale-[1.01]',
                  isSelected
                    ? 'border-primary shadow-md ring-2 ring-primary/20 bg-card'
                    : 'border-border/60 hover:border-border bg-card/60'
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

                <div className="flex items-center gap-2">
                  {th.colors.map((c, i) => (
                    <span
                      key={i}
                      className="h-6 w-6 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Color Pickers + Live Preview */}
        <div className="mt-6 pt-5 border-t border-border/50 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Custom Brand Color Scheme
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { key: 'primary' as const, label: 'Primary Color', fallback: form.primary_color || '#171717' },
                { key: 'secondary' as const, label: 'Secondary Color', fallback: form.secondary_color || '#f4f4f5' },
                { key: 'accent' as const, label: 'Accent Color', fallback: form.accent_color || '#ececed' },
                { key: 'button' as const, label: 'Button Fill', fallback: form.primary_color || '#171717' },
                { key: 'header' as const, label: 'Header Bar', fallback: '#ffffff' },
                { key: 'navigation' as const, label: 'Bottom Nav', fallback: '#ffffff' },
                { key: 'background' as const, label: 'Background', fallback: form.background_color || '#ffffff' },
                { key: 'text' as const, label: 'Text Tint', fallback: '#171717' },
              ].map((item) => {
                const value = form.custom_colors?.[item.key] || item.fallback;
                return (
                  <div key={item.key} className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1.5">
                    <Label className="text-[11px] font-bold block">{item.label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={item.label}
                        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#171717'}
                        onChange={(e) => updateCustomColor(item.key, e.target.value)}
                        className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0"
                      />
                      <Input
                        value={value}
                        onChange={(e) => updateCustomColor(item.key, e.target.value)}
                        className="h-7 text-[11px] font-mono px-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="max-w-xs">
              <Label className="text-xs font-bold mb-1.5 block">Default Appearance Mode</Label>
              <Select
                value={form.default_appearance || 'system'}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, default_appearance: v as 'light' | 'dark' | 'system' }))
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system" className="text-xs">Follow User System Preference</SelectItem>
                  <SelectItem value="light" className="text-xs">Default Light Mode</SelectItem>
                  <SelectItem value="dark" className="text-xs">Default Dark Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Interactive Live Theme Preview Card */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" /> Live Preview
            </h4>
            <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
              <div
                className="px-4 py-3 flex items-center justify-between text-xs font-bold border-b border-border/50"
                style={{
                  backgroundColor: form.custom_colors?.header ? previewHeader : undefined,
                  color: form.custom_colors?.header ? '#ffffff' : undefined,
                }}
              >
                <span className="truncate">{form.app_name || 'DealerConnect AI'}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px]"
                  style={{ backgroundColor: previewAccent, color: '#171717' }}
                >
                  {form.theme_preset}
                </span>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <p className="font-bold text-foreground">
                  {form.homepage_config?.headings?.hero_title || 'Local Shop Product Finder'}
                </p>
                <p className="text-muted-foreground line-clamp-2 text-[11px]">
                  {form.tagline || 'Your Trusted Local Shop Product Finder'}
                </p>
                <button
                  type="button"
                  className="w-full py-2 rounded-xl text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: previewPrimary }}
                >
                  Sample Primary Action
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. APP IDENTITY & BRANDING */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <div className="pb-4 border-b border-border/40">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> App Identity, Logo &amp; Name
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure application title, logo image, and subtitle displayed across Customer and Dealer portals.
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

          <div className="sm:col-span-2 p-3 rounded-xl border border-border bg-muted/20">
            <ImagePicker
              value={form.logo_url || ''}
              onChange={(url) => setForm((p) => ({ ...p, logo_url: url }))}
              label="Brand Logo Image"
              description="Upload a logo or paste URL"
            />
          </div>
        </div>
      </Card>

      {/* 3. HOMEPAGE DESIGN & SECTION TOGGLES */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <div className="pb-4 border-b border-border/40">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" /> Homepage Design &amp; Sections Visibility
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Turn sections on or off, and customize headings synced directly to the Customer App homepage.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {[
            { key: 'categories', title: 'Popular Categories Row', desc: 'Horizontal scrollable category bar' },
            { key: 'offers', title: "Today's Showroom Offers", desc: 'Discounted local store listings' },
            { key: 'nearby', title: 'Nearby Verified Shops', desc: 'Neighborhood dealers sorted by proximity' },
          ].map((sec) => {
            const enabled =
              form.homepage_config?.sections?.find((s) => s.type === sec.key)?.enabled ?? true;
            return (
              <div
                key={sec.key}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5"
              >
                <div>
                  <h4 className="text-sm font-semibold">{sec.title}</h4>
                  <p className="text-xs text-muted-foreground">{sec.desc}</p>
                </div>
                <Switch checked={enabled} onCheckedChange={(v) => updateSection(sec.key, v)} />
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-semibold">Hero Headline</Label>
            <Input
              value={form.homepage_config?.headings?.hero_title || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  homepage_config: {
                    ...(p.homepage_config as NonNullable<AppSettings['homepage_config']>),
                    headings: { ...(p.homepage_config?.headings || {}), hero_title: e.target.value },
                  },
                }))
              }
              className="rounded-xl text-sm"
              placeholder="Local Shop Product Finder"
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
                    ...(p.homepage_config as NonNullable<AppSettings['homepage_config']>),
                    headings: { ...(p.homepage_config?.headings || {}), hero_subtitle: e.target.value },
                  },
                }))
              }
              rows={2}
              className="rounded-xl text-sm"
              placeholder="Discover genuine products in your neighborhood..."
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Featured Section Title</Label>
            <Input
              value={form.homepage_config?.headings?.featured_title || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  homepage_config: {
                    ...(p.homepage_config as NonNullable<AppSettings['homepage_config']>),
                    headings: { ...(p.homepage_config?.headings || {}), featured_title: e.target.value },
                  },
                }))
              }
              className="rounded-xl text-sm"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Nearby Shops Section Title</Label>
            <Input
              value={form.homepage_config?.headings?.dealers_title || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  homepage_config: {
                    ...(p.homepage_config as NonNullable<AppSettings['homepage_config']>),
                    headings: { ...(p.homepage_config?.headings || {}), dealers_title: e.target.value },
                  },
                }))
              }
              className="rounded-xl text-sm"
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
            Configure image banners and call-to-action links displayed on the Customer App homepage.
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
      <div className="sticky bottom-6 z-20 flex justify-end gap-3">
        <Button type="button" variant="outline" size="lg" onClick={handleResetToDefault} disabled={saving}>
          Reset to Default
        </Button>
        <Button type="submit" size="lg" className="rounded-2xl px-8 font-bold shadow-xl text-base" disabled={saving}>
          <Save className="mr-2 h-5 w-5" />
          {saving ? 'Publishing...' : 'Save & Publish Live'}
        </Button>
      </div>
    </form>
  );
}
