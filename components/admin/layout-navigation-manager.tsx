'use client';

import { useState } from 'react';
import {
  Sliders, ArrowUp, ArrowDown, Eye, EyeOff, Lock, CheckCircle2,
  RotateCcw, Save, ShieldAlert, Sparkles, FolderTree, LayoutDashboard,
  PanelsTopLeft, Store, Package
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  type AdminMenuItem,
  DEFAULT_ADMIN_MENU,
  saveStoredAdminMenu,
} from './admin-menu-config';
import { useApp } from '@/lib/providers';
import { toast } from 'sonner';

type LayoutManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItems: AdminMenuItem[];
  onUpdateMenu: (items: AdminMenuItem[]) => void;
};

export function LayoutNavigationManager({
  open,
  onOpenChange,
  menuItems,
  onUpdateMenu,
}: LayoutManagerProps) {
  const { appSettings, updateAppSettings } = useApp();
  const [draftMenu, setDraftMenu] = useState<AdminMenuItem[]>(() => [...menuItems]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  // Homepage sections draft
  const [homepageSections, setHomepageSections] = useState(() => {
    return JSON.parse(JSON.stringify(appSettings.homepage_config?.sections || []));
  });

  // When opening, refresh draft from current menuItems
  const handleOpen = (newOpen: boolean) => {
    if (newOpen) {
      setDraftMenu([...menuItems]);
      setHomepageSections(JSON.parse(JSON.stringify(appSettings.homepage_config?.sections || [])));
    }
    onOpenChange(newOpen);
  };

  // Move Admin Menu item
  const moveMenuItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draftMenu.length) return;

    const copy = [...draftMenu];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    // Re-assign order numbers 1..14
    const updated = copy.map((item, idx) => ({ ...item, order: idx + 1 }));
    setDraftMenu(updated);
  };

  // Toggle Admin Menu visibility
  const toggleMenuVisibility = (id: string, enabled: boolean) => {
    setDraftMenu((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.locked) {
            toast.error('This core module is locked to maintain administrative access');
            return item;
          }
          return { ...item, enabled };
        }
        return item;
      })
    );
  };

  // Reset Admin Menu to factory default order
  const handleResetDefaultMenu = () => {
    if (!confirm('Reset admin navigation menu to the default 14-module order?')) return;
    setDraftMenu([...DEFAULT_ADMIN_MENU]);
    toast.info('Menu draft reset to default order');
  };

  // Move Homepage Section
  const moveHomepageSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= homepageSections.length) return;

    const copy = [...homepageSections];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setHomepageSections(copy);
  };

  // Toggle Homepage Section visibility
  const toggleHomepageSection = (id: string, enabled: boolean) => {
    setHomepageSections((prev: any[]) =>
      prev.map((s) => (s.id === id ? { ...s, enabled } : s))
    );
  };

  // Save all layout changes
  const handleSaveAndPublish = async () => {
    setSaving(true);
    try {
      // 1. Save admin menu arrangement
      saveStoredAdminMenu(draftMenu);
      onUpdateMenu(draftMenu);

      // 2. Save customer homepage layout
      await updateAppSettings({
        homepage_config: {
          ...(appSettings.homepage_config as any),
          sections: homepageSections,
        },
      });

      toast.success('Layout & Navigation changes successfully published!');
      onOpenChange(false);
    } catch {
      toast.error('Failed to save layout changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sliders className="h-5 w-5 text-primary" /> Layout & Navigation Manager
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-semibold">
              Platform Arranger
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Administer the layout, sequence, and visibility of navigation modules across both Admin and Customer apps
          </DialogDescription>
        </DialogHeader>

        {/* Protection Alert */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p>
            <span className="font-bold">Protected Navigation Security:</span> Critical modules like{' '}
            <span className="font-semibold">01. Dashboard</span> and{' '}
            <span className="font-semibold">14. Settings</span> are locked to prevent accidental lockout of security controls.
          </p>
        </div>

        <Tabs defaultValue="admin-nav" className="pt-2">
          <TabsList className="grid grid-cols-2 h-9 w-full">
            <TabsTrigger value="admin-nav" className="text-xs font-semibold">
              Admin Menu Layout ({draftMenu.filter((m) => m.enabled).length}/14 Active)
            </TabsTrigger>
            <TabsTrigger value="customer-home" className="text-xs font-semibold">
              Customer Homepage Layout ({homepageSections.filter((s: any) => s.enabled).length} Active)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ADMIN MENU LAYOUT */}
          <TabsContent value="admin-nav" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Reorder menu items with the arrows or toggle visibility.
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetDefaultMenu}
                className="h-7 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset Default
              </Button>
            </div>

            <Card className="border-border/80 overflow-hidden divide-y divide-border/60">
              {draftMenu.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Move buttons */}
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveMenuItem(index, 'up')}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === draftMenu.length - 1}
                        onClick={() => moveMenuItem(index, 'down')}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Number and title */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {item.number}.
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-foreground">
                          {item.title}
                        </span>
                        {item.locked && (
                          <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{item.shortDesc}</p>
                    </div>
                  </div>

                  {/* Visibility switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {item.enabled ? 'Enabled' : 'Hidden'}
                    </span>
                    <Switch
                      checked={item.enabled}
                      disabled={item.locked}
                      onCheckedChange={(checked) => toggleMenuVisibility(item.id, checked)}
                    />
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>

          {/* TAB 2: CUSTOMER HOMEPAGE LAYOUT */}
          <TabsContent value="customer-home" className="mt-4 space-y-4">
            <div className="text-xs text-muted-foreground">
              Rearrange the position of homepage discovery sections in the customer-facing application.
            </div>

            <Card className="border-border/80 overflow-hidden divide-y divide-border/60">
              {homepageSections.map((sec: any, index: number) => (
                <div
                  key={sec.id || index}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveHomepageSection(index, 'up')}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === homepageSections.length - 1}
                        onClick={() => moveHomepageSection(index, 'down')}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="font-bold text-xs sm:text-sm text-foreground">
                        {index + 1}. {sec.title}
                      </div>
                      {sec.subtitle && (
                        <p className="text-[11px] text-muted-foreground">{sec.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={sec.enabled ? 'default' : 'secondary'} className="text-[10px]">
                      {sec.enabled ? 'Live' : 'Hidden'}
                    </Badge>
                    <Switch
                      checked={sec.enabled ?? true}
                      onCheckedChange={(checked) => toggleHomepageSection(sec.id, checked)}
                    />
                  </div>
                </div>
              ))}
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAndPublish} disabled={saving} className="font-bold gap-1.5 shadow-md">
            <Save className="h-4 w-4" /> {saving ? 'Publishing...' : 'Save & Publish Layout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
